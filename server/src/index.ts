// ── GoClaw WebChat Proxy Server ──
// Keeps gateway auth tokens server-side, proxies WebSocket frames to GoClaw Gateway.

import 'dotenv/config';
import { loadConfig } from './proxy-config.js';
import { startProxyServer } from './proxy-server.js';

try {
  const config = loadConfig();
  startProxyServer(config);
} catch (err) {
  console.error(`[proxy] fatal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
