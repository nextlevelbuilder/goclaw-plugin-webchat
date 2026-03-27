/**
 * Express Embedded Proxy Example
 *
 * Shows how to embed the GoClaw WebSocket proxy into an existing Express/Node.js app.
 * This is the most common integration pattern — your backend already runs Express,
 * and you want to add GoClaw chat without running a separate proxy process.
 *
 * Usage:
 *   npx tsx examples/express-embedded-proxy.ts
 *
 * Prerequisites:
 *   npm install express ws
 *   npm install -D @types/express @types/ws tsx
 */

import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'node:path';

// ── Config ──
const GOCLAW_URL = process.env.GOCLAW_URL ?? 'wss://digitop.goclaw.sh/ws';
const GOCLAW_TOKEN = process.env.GOCLAW_TOKEN ?? '';
const PORT = parseInt(process.env.PORT ?? '3000', 10);

if (!GOCLAW_TOKEN) {
  console.error('Set GOCLAW_TOKEN environment variable');
  process.exit(1);
}

// ── Express app with your existing routes ──
const app = express();
app.use(express.json());

// Serve widget dist files
app.use('/dist', express.static(path.resolve(import.meta.dirname, '..', 'dist')));

// Your existing API routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', chat: 'proxy embedded' });
});

// Serve the chat page
app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html><head>
  <title>My App with Embedded GoClaw Proxy</title>
  <style>body { font-family: sans-serif; max-width: 600px; margin: 40px auto; }</style>
</head><body>
  <h1>My Express App</h1>
  <p>The GoClaw chat widget connects to <code>/ws</code> on this same server.
     No separate proxy process needed.</p>

  <script src="/dist/goclaw-webchat.umd.js"></script>
  <script>
    GoClaw.init({
      url: 'ws://localhost:${PORT}/ws',
      title: 'Support Chat',
      theme: 'auto',
      welcomeMessage: 'Hi! This chat runs on the same Express server as the app.',
    });
  </script>
</body></html>`);
});

// ── HTTP server ──
const server = createServer(app);

// ── WebSocket proxy on /ws ──
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (clientWs) => {
  console.log('[proxy] client connected');

  // Connect to upstream GoClaw gateway
  const upstream = new WebSocket(GOCLAW_URL);

  upstream.on('open', () => {
    console.log('[proxy] upstream connected');
  });

  // Relay upstream → client (strip token fields)
  upstream.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data.toString());
    }
  });

  // Relay client → upstream (inject token into connect frames)
  clientWs.on('message', (data) => {
    const raw = data.toString();
    try {
      const frame = JSON.parse(raw);

      // Inject auth token into connect request
      if (frame.type === 'req' && frame.method === 'connect') {
        frame.params = frame.params ?? {};
        frame.params.token = GOCLAW_TOKEN;
        upstream.send(JSON.stringify(frame));
        return;
      }
    } catch { /* non-JSON — pass through */ }

    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(raw);
    }
  });

  // Clean up
  clientWs.on('close', () => {
    console.log('[proxy] client disconnected');
    upstream.close();
  });

  upstream.on('close', () => {
    clientWs.close();
  });

  upstream.on('error', (err) => {
    console.error('[proxy] upstream error:', err.message);
    clientWs.close(1011, 'upstream error');
  });
});

// ── Start ──
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`WebSocket proxy at ws://localhost:${PORT}/ws`);
  console.log(`Upstream: ${GOCLAW_URL}`);
});
