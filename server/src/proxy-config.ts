// ── Proxy server configuration from environment variables ──

const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = typeof VALID_LOG_LEVELS[number];

export interface ProxyConfig {
  /** Port to listen on (default: 3100) */
  port: number;
  /** GoClaw Gateway WebSocket URL (e.g., "ws://localhost:9090/ws") */
  goclawUrl: string;
  /** GoClaw Gateway auth token (kept server-side, never exposed) */
  goclawToken: string;
  /** Allowed origins for CORS/WebSocket origin check (comma-separated, empty = allow all) */
  allowedOrigins: string[];
  /** Default agent ID to use if client doesn't specify one */
  defaultAgentId?: string;
  /** Max concurrent connections per IP (default: 10) */
  maxConnectionsPerIp: number;
  /** Trust X-Forwarded-For/X-Real-IP headers (default: false, set true when behind reverse proxy) */
  trustProxy: boolean;
  /** Log level: "debug" | "info" | "warn" | "error" (default: "info") */
  logLevel: LogLevel;
  /** Optional API key to authenticate proxy connections (empty = no auth required) */
  proxyApiKey?: string;
}

/** Load proxy config from environment variables with sensible defaults */
export function loadConfig(): ProxyConfig {
  const goclawUrl = process.env.GOCLAW_URL;
  if (!goclawUrl) {
    throw new Error('GOCLAW_URL environment variable is required (e.g., "ws://localhost:9090/ws")');
  }

  const goclawToken = process.env.GOCLAW_TOKEN ?? '';
  if (!goclawToken) {
    console.warn('[proxy] WARNING: GOCLAW_TOKEN not set — proxy will connect without authentication');
  }

  const originsRaw = process.env.ALLOWED_ORIGINS ?? '';
  const allowedOrigins = originsRaw
    ? originsRaw.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  const port = parseInt(process.env.PORT ?? '3100', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a number between 1 and 65535');
  }

  const maxConnectionsPerIp = parseInt(process.env.MAX_CONNECTIONS_PER_IP ?? '10', 10);
  if (isNaN(maxConnectionsPerIp) || maxConnectionsPerIp < 1) {
    throw new Error('MAX_CONNECTIONS_PER_IP must be a positive number');
  }

  const logLevel = (process.env.LOG_LEVEL ?? 'info') as LogLevel;
  if (!VALID_LOG_LEVELS.includes(logLevel)) {
    throw new Error(`LOG_LEVEL must be one of: ${VALID_LOG_LEVELS.join(', ')}`);
  }

  return {
    port,
    goclawUrl,
    goclawToken,
    allowedOrigins,
    defaultAgentId: process.env.DEFAULT_AGENT_ID,
    maxConnectionsPerIp,
    trustProxy: process.env.TRUST_PROXY === 'true',
    logLevel,
    proxyApiKey: process.env.PROXY_API_KEY || undefined,
  };
}
