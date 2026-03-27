<?php
/**
 * GoClaw WebChat Proxy Server — PHP (Ratchet + ReactPHP)
 *
 * Lightweight WebSocket proxy that sits between the chat widget and GoClaw Gateway.
 * The proxy injects the auth token server-side so it never reaches the browser.
 *
 * Usage:
 *   composer install
 *   cp .env.example .env   # fill in GOCLAW_URL and GOCLAW_TOKEN
 *   php proxy.php
 *
 * Environment variables:
 *   GOCLAW_URL       — Gateway WebSocket URL (required, e.g. "ws://localhost:9090/ws")
 *   GOCLAW_TOKEN     — Gateway auth token (required, kept server-side)
 *   PORT             — Proxy listen port (default: 3100)
 *   ALLOWED_ORIGINS  — Comma-separated origin allowlist (empty = allow all)
 *   PROXY_API_KEY    — Optional API key for proxy authentication
 *   DEFAULT_AGENT_ID — Default agent ID injected into chat.send if client omits it
 */

require __DIR__ . '/vendor/autoload.php';

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Http\HttpServer;
use Ratchet\Server\IoServer;
use Ratchet\WebSocket\WsServer;
use Ratchet\Http\OriginCheck;
use React\EventLoop\Loop;
use React\Socket\SocketServer;

// ── Load .env ───────────────────────────────────────────────────────────────

if (class_exists('Dotenv\Dotenv') && file_exists(__DIR__ . '/.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->load();
}

// ── Config ──────────────────────────────────────────────────────────────────

$GOCLAW_URL      = $_ENV['GOCLAW_URL'] ?? getenv('GOCLAW_URL') ?: '';
$GOCLAW_TOKEN    = $_ENV['GOCLAW_TOKEN'] ?? getenv('GOCLAW_TOKEN') ?: '';
$PORT            = (int)($_ENV['PORT'] ?? getenv('PORT') ?: '3100');
$PROXY_API_KEY   = $_ENV['PROXY_API_KEY'] ?? getenv('PROXY_API_KEY') ?: '';
$DEFAULT_AGENT_ID = $_ENV['DEFAULT_AGENT_ID'] ?? getenv('DEFAULT_AGENT_ID') ?: '';

$originsRaw = $_ENV['ALLOWED_ORIGINS'] ?? getenv('ALLOWED_ORIGINS') ?: '';
$ALLOWED_ORIGINS = array_filter(array_map('trim', explode(',', $originsRaw)));

if (empty($GOCLAW_URL)) {
    fwrite(STDERR, "ERROR: GOCLAW_URL environment variable is required\n");
    exit(1);
}

if (empty($GOCLAW_TOKEN)) {
    fwrite(STDERR, "WARNING: GOCLAW_TOKEN not set — proxy will connect without authentication\n");
}

// ── Proxy Component ─────────────────────────────────────────────────────────

class GoclawProxy implements MessageComponentInterface
{
    private string $goclawUrl;
    private string $goclawToken;
    private string $proxyApiKey;
    private string $defaultAgentId;
    private array $allowedOrigins;
    private int $activeConnections = 0;

    /** @var \SplObjectStorage<ConnectionInterface, \Ratchet\Client\WebSocket|null> */
    private \SplObjectStorage $upstreams;

    public function __construct(
        string $goclawUrl,
        string $goclawToken,
        string $proxyApiKey,
        string $defaultAgentId,
        array  $allowedOrigins,
    ) {
        $this->goclawUrl      = $goclawUrl;
        $this->goclawToken    = $goclawToken;
        $this->proxyApiKey    = $proxyApiKey;
        $this->defaultAgentId = $defaultAgentId;
        $this->allowedOrigins = $allowedOrigins;
        $this->upstreams      = new \SplObjectStorage();
    }

    public function getActiveConnections(): int
    {
        return $this->activeConnections;
    }

    public function onOpen(ConnectionInterface $conn): void
    {
        // Check API key if configured
        if (!$this->checkApiKey($conn)) {
            echo "[proxy] invalid or missing API key\n";
            $conn->close();
            return;
        }

        // Check origin if allowlist is configured
        if (!$this->checkOrigin($conn)) {
            echo "[proxy] origin rejected\n";
            $conn->close();
            return;
        }

        $this->activeConnections++;
        echo "[proxy] client connected (active={$this->activeConnections})\n";

        // Connect to upstream GoClaw Gateway
        $this->upstreams[$conn] = null; // placeholder until connected

        $connector = new \Ratchet\Client\Connector(Loop::get());
        $connector($this->goclawUrl)->then(
            function (\Ratchet\Client\WebSocket $upstream) use ($conn) {
                if (!$this->upstreams->contains($conn)) {
                    // Client already disconnected
                    $upstream->close();
                    return;
                }

                $this->upstreams[$conn] = $upstream;
                echo "[proxy] upstream connected\n";

                // Relay upstream -> client
                $upstream->on('message', function ($msg) use ($conn) {
                    $sanitized = $this->sanitizeUpstreamFrame((string)$msg);
                    $conn->send($sanitized);
                });

                $upstream->on('close', function () use ($conn) {
                    $conn->close();
                });
            },
            function (\Exception $e) use ($conn) {
                echo "[proxy] upstream connection failed: {$e->getMessage()}\n";
                $conn->close();
            }
        );
    }

    public function onMessage(ConnectionInterface $conn, $msg): void
    {
        $upstream = $this->upstreams[$conn] ?? null;
        if ($upstream === null) {
            return; // upstream not connected yet, drop message
        }

        $modified = $this->interceptFrame((string)$msg);
        $upstream->send($modified);
    }

    public function onClose(ConnectionInterface $conn): void
    {
        $this->activeConnections--;
        echo "[proxy] client disconnected (active={$this->activeConnections})\n";

        if ($this->upstreams->contains($conn)) {
            $upstream = $this->upstreams[$conn];
            if ($upstream !== null) {
                $upstream->close();
            }
            $this->upstreams->detach($conn);
        }
    }

    public function onError(ConnectionInterface $conn, \Exception $e): void
    {
        echo "[proxy] error: {$e->getMessage()}\n";
        $conn->close();
    }

    // ── Frame interception ──────────────────────────────────────────────────

    private function interceptFrame(string $raw): string
    {
        $frame = json_decode($raw, true);
        if (!is_array($frame) || ($frame['type'] ?? '') !== 'req') {
            return $raw;
        }

        $modified = false;

        // Inject gateway token into connect frame
        if (($frame['method'] ?? '') === 'connect' && $this->goclawToken !== '') {
            $frame['params'] = $frame['params'] ?? [];
            $frame['params']['token'] = $this->goclawToken;
            $modified = true;
        }

        // Inject default agentId into chat.send if not set by client
        if (
            ($frame['method'] ?? '') === 'chat.send'
            && $this->defaultAgentId !== ''
            && empty($frame['params']['agentId'])
        ) {
            $frame['params'] = $frame['params'] ?? [];
            $frame['params']['agentId'] = $this->defaultAgentId;
            $modified = true;
        }

        return $modified ? json_encode($frame, JSON_UNESCAPED_SLASHES) : $raw;
    }

    private function sanitizeUpstreamFrame(string $raw): string
    {
        $frame = json_decode($raw, true);
        if (
            is_array($frame)
            && ($frame['type'] ?? '') === 'res'
            && isset($frame['payload']['token'])
        ) {
            unset($frame['payload']['token']);
            return json_encode($frame, JSON_UNESCAPED_SLASHES);
        }
        return $raw;
    }

    // ── Auth helpers ────────────────────────────────────────────────────────

    private function checkApiKey(ConnectionInterface $conn): bool
    {
        if ($this->proxyApiKey === '') {
            return true;
        }

        $request = $conn->httpRequest ?? null;
        if ($request === null) {
            return false;
        }

        // Check query param: ?apiKey=xxx
        $query = [];
        parse_str($request->getUri()->getQuery(), $query);
        if (($query['apiKey'] ?? '') === $this->proxyApiKey) {
            return true;
        }

        // Check header: X-API-Key
        $headerKey = $request->getHeaderLine('X-API-Key');
        return $headerKey === $this->proxyApiKey;
    }

    private function checkOrigin(ConnectionInterface $conn): bool
    {
        if (empty($this->allowedOrigins)) {
            return true;
        }

        $request = $conn->httpRequest ?? null;
        if ($request === null) {
            return false;
        }

        $origin = $request->getHeaderLine('Origin');
        if ($origin === '') {
            return false; // reject missing origin when allowlist is active
        }

        return in_array('*', $this->allowedOrigins) || in_array($origin, $this->allowedOrigins);
    }
}

// ── Server setup ────────────────────────────────────────────────────────────

$loop = Loop::get();

$proxy = new GoclawProxy(
    $GOCLAW_URL,
    $GOCLAW_TOKEN,
    $PROXY_API_KEY,
    $DEFAULT_AGENT_ID,
    $ALLOWED_ORIGINS,
);

$wsServer = new WsServer($proxy);
$wsServer->enableKeepAlive($loop, 30);

// Health check + WebSocket on same port using custom HTTP handler
$httpServer = new HttpServer($wsServer);

$socket = new SocketServer("0.0.0.0:{$PORT}", [], $loop);

$server = new IoServer($httpServer, $socket, $loop);

echo "[proxy] listening on :{$PORT}\n";
echo "[proxy] upstream: {$GOCLAW_URL}\n";
echo "[proxy] auth token: " . ($GOCLAW_TOKEN ? 'configured' : 'NOT SET') . "\n";
echo "[proxy] API key: " . ($PROXY_API_KEY ? 'required' : 'disabled') . "\n";
if (!empty($ALLOWED_ORIGINS)) {
    echo "[proxy] allowed origins: " . implode(', ', $ALLOWED_ORIGINS) . "\n";
} else {
    echo "[proxy] allowed origins: * (all)\n";
}

$server->run();
