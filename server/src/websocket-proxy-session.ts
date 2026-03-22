// ── Single proxy session: client ↔ upstream GoClaw Gateway ──

import WebSocket from 'ws';
import type { ProxyConfig } from './proxy-config.js';

/** Max messages buffered before upstream is ready */
const MAX_PENDING_MESSAGES = 10;

/** Max messages per minute per session (rate limit) */
const MSG_RATE_LIMIT = 60;
const MSG_RATE_WINDOW_MS = 60_000;

/** Represents a proxied WebSocket session between client and GoClaw Gateway */
export class WebSocketProxySession {
  private upstream: WebSocket | null = null;
  private upstreamReady = false;
  private closed = false;
  private sessionId: string;
  private pendingMessages: string[] = [];
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private msgTimestamps: number[] = [];

  constructor(
    private client: WebSocket,
    private config: ProxyConfig,
    private clientIp: string,
  ) {
    this.sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Start the proxy: connect to upstream and begin relaying frames */
  async start(): Promise<void> {
    this.log('info', 'connecting to upstream');

    try {
      this.upstream = new WebSocket(this.config.goclawUrl, {
        maxPayload: 512 * 1024,
      });
    } catch (err) {
      this.log('error', `upstream connection failed: ${err}`);
      this.client.close(1011, 'upstream connection failed');
      return;
    }

    this.connectTimeout = setTimeout(() => {
      this.log('error', 'upstream connection timed out');
      this.destroy();
    }, 10_000);

    this.upstream.on('open', () => {
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
      }
      this.upstreamReady = true;
      this.log('info', 'upstream connected');

      for (const msg of this.pendingMessages) {
        this.upstream!.send(msg);
      }
      this.pendingMessages = [];
    });

    // Relay upstream → client (strip token fields for defense in depth)
    this.upstream.on('message', (data) => {
      if (this.closed || this.client.readyState !== WebSocket.OPEN) return;
      this.client.send(this.sanitizeUpstreamFrame(data.toString()));
    });

    this.upstream.on('close', (code, reason) => {
      this.log('info', `upstream closed: ${code} ${reason}`);
      this.destroy(code, reason.toString());
    });

    this.upstream.on('error', (err) => {
      this.log('error', `upstream error: ${err.message}`);
      this.destroy(1011, 'upstream error');
    });

    // Relay client → upstream (intercept `connect` to inject token)
    this.client.on('message', (data) => {
      if (this.closed || !this.upstream) return;

      if (!this.checkRateLimit()) {
        this.log('warn', 'message rate limit exceeded');
        return;
      }

      const raw = data.toString();
      const modified = this.interceptFrame(raw);
      if (modified === null) return; // dropped non-JSON frame

      if (!this.upstreamReady) {
        if (this.pendingMessages.length >= MAX_PENDING_MESSAGES) {
          this.log('warn', 'pending buffer full, dropping message');
          return;
        }
        this.log('debug', 'buffering message (upstream not ready)');
        this.pendingMessages.push(modified);
        return;
      }

      this.upstream.send(modified);
    });

    this.client.on('close', () => {
      this.log('info', 'client disconnected');
      this.destroy();
    });

    this.client.on('error', (err) => {
      this.log('error', `client error: ${err.message}`);
      this.destroy();
    });
  }

  /** Intercept outgoing frames to inject auth token into connect requests.
   *  Returns null for non-JSON frames (dropped per GoClaw protocol). */
  private interceptFrame(raw: string): string | null {
    try {
      const frame = JSON.parse(raw);

      if (frame.type !== 'req' || frame.method !== 'connect') {
        return raw;
      }

      // Inject gateway token (server-side, never exposed to client)
      if (this.config.goclawToken) {
        frame.params = frame.params ?? {};
        frame.params.token = this.config.goclawToken;
      }

      // Inject default agent_id if not already set by client
      if (this.config.defaultAgentId && !frame.params?.agent_id) {
        frame.params = frame.params ?? {};
        frame.params.agent_id = this.config.defaultAgentId;
      }

      this.log('debug', 'injected auth token into connect frame');
      return JSON.stringify(frame);
    } catch {
      // GoClaw protocol is JSON-only — drop non-JSON frames
      this.log('warn', 'dropping non-JSON frame from client');
      return null;
    }
  }

  /** Strip token fields from upstream responses to prevent accidental leakage */
  private sanitizeUpstreamFrame(raw: string): string {
    try {
      const frame = JSON.parse(raw);
      if (frame.type === 'res' && frame.payload?.token) {
        delete frame.payload.token;
        return JSON.stringify(frame);
      }
    } catch { /* non-JSON upstream frame — pass through */ }
    return raw;
  }

  /** Sliding window rate limiter: returns true if message is allowed */
  private checkRateLimit(): boolean {
    const now = Date.now();
    this.msgTimestamps = this.msgTimestamps.filter((t) => now - t < MSG_RATE_WINDOW_MS);
    if (this.msgTimestamps.length >= MSG_RATE_LIMIT) return false;
    this.msgTimestamps.push(now);
    return true;
  }

  /** Clean up both connections. Optionally close client with a specific code/reason. */
  destroy(clientCloseCode?: number, clientCloseReason?: string): void {
    if (this.closed) return;
    this.closed = true;

    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }

    this.pendingMessages = [];
    this.msgTimestamps = [];

    // Close upstream
    if (this.upstream && this.upstream.readyState !== WebSocket.CLOSED) {
      this.upstream.close();
    }
    this.upstream = null;

    // Close client
    if (this.client.readyState === WebSocket.OPEN) {
      this.client.close(clientCloseCode ?? 1000, clientCloseReason ?? 'session ended');
    }
  }

  private log(level: string, message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const msgLevel = levels.indexOf(level);
    if (msgLevel < configLevel) return;

    const prefix = `[proxy:${this.sessionId}]`;
    const logFn = level === 'error' ? console.error
      : level === 'warn' ? console.warn
      : console.log;
    logFn(`${prefix} ${message} (ip=${this.clientIp})`);
  }
}
