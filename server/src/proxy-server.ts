// ── WebSocket proxy server: accepts client connections and proxies to GoClaw Gateway ──

import { createServer, type IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { ProxyConfig } from './proxy-config.js';
import { ConnectionTracker } from './connection-tracker.js';
import { WebSocketProxySession } from './websocket-proxy-session.js';

/** Start the WebSocket proxy server */
export function startProxyServer(config: ProxyConfig): void {
  const tracker = new ConnectionTracker(config.maxConnectionsPerIp);
  const sessions = new Set<WebSocketProxySession>();

  const httpServer = createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        connections: tracker.totalConnections,
      }));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    maxPayload: 512 * 1024, // 512KB max frame size (matches GoClaw gateway limit)
    verifyClient: ({ req }, callback) => {
      // Origin check
      if (!checkOrigin(req, config.allowedOrigins)) {
        console.warn(`[proxy] origin rejected: ${req.headers.origin}`);
        callback(false, 403, 'Origin not allowed');
        return;
      }

      // Per-IP connection limit
      const ip = extractClientIp(req, config.trustProxy);
      if (!tracker.canConnect(ip)) {
        console.warn(`[proxy] connection limit reached for ${ip}`);
        callback(false, 429, 'Too many connections');
        return;
      }

      callback(true);
    },
  });

  wss.on('connection', (clientWs: WebSocket, req: IncomingMessage) => {
    const ip = extractClientIp(req, config.trustProxy);
    tracker.add(ip);

    const session = new WebSocketProxySession(clientWs, config, ip);
    sessions.add(session);

    // Clean up on disconnect
    clientWs.on('close', () => {
      tracker.remove(ip);
      session.destroy();
      sessions.delete(session);
    });

    // Start proxying
    session.start().catch((err) => {
      console.error(`[proxy] session start failed: ${err}`);
      clientWs.close(1011, 'proxy error');
    });
  });

  httpServer.listen(config.port, () => {
    console.log(`[proxy] listening on :${config.port}`);
    console.log(`[proxy] upstream: ${config.goclawUrl}`);
    console.log(`[proxy] auth token: ${config.goclawToken ? 'configured' : 'NOT SET'}`);
    if (config.allowedOrigins.length > 0) {
      console.log(`[proxy] allowed origins: ${config.allowedOrigins.join(', ')}`);
    } else {
      console.log('[proxy] allowed origins: * (all)');
    }
  });

  // Graceful shutdown with drain timeout
  const shutdown = () => {
    console.log('[proxy] shutting down...');
    for (const session of sessions) {
      session.destroy();
    }
    sessions.clear();
    wss.close(() => {
      httpServer.close(() => process.exit(0));
    });
    // Force exit after 5 seconds if drain stalls
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/** Validate request origin against allowed origins list.
 * When origins are configured, missing Origin header is rejected
 * to prevent bypass via non-browser clients. */
function checkOrigin(req: IncomingMessage, allowedOrigins: string[]): boolean {
  if (allowedOrigins.length === 0) return true; // no restriction configured

  const origin = req.headers.origin;
  if (!origin) return false; // reject missing origin when allowlist is active

  return allowedOrigins.some((allowed) => allowed === '*' || allowed === origin);
}

/** Extract client IP — only trust proxy headers when trustProxy is enabled */
function extractClientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string') return realIp;

    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
  }

  return req.socket.remoteAddress ?? 'unknown';
}
