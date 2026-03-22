// ── Single proxy session: client ↔ upstream GoClaw Gateway ──

import WebSocket from 'ws';
import type { ProxyConfig } from './proxy-config.js';

/** Represents a proxied WebSocket session between client and GoClaw Gateway */
export class WebSocketProxySession {
  private upstream: WebSocket | null = null;
  private upstreamReady = false;
  private closed = false;
  private sessionId: string;
  private pendingMessages: string[] = [];
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;

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
        maxPayload: 512 * 1024, // 512KB max frame size (matches GoClaw gateway)
      });
    } catch (err) {
      this.log('error', `upstream connection failed: ${err}`);
      this.client.close(1011, 'upstream connection failed');
      return;
    }

    // Timeout if upstream doesn't connect within 10 seconds
    this.connectTimeout = setTimeout(() => {
      this.log('error', 'upstream connection timed out');
      this.upstream?.close();
      this.closeClient(1011, 'upstream timeout');
    }, 10_000);

    this.upstream.on('open', () => {
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
      }
      this.upstreamReady = true;
      this.log('info', 'upstream connected');

      // Flush any messages queued while upstream was connecting
      for (const msg of this.pendingMessages) {
        this.upstream!.send(msg);
      }
      this.pendingMessages = [];
    });

    // Relay upstream → client (passthrough all frames)
    this.upstream.on('message', (data) => {
      if (this.closed || this.client.readyState !== WebSocket.OPEN) return;
      this.client.send(data);
    });

    this.upstream.on('close', (code, reason) => {
      this.log('info', `upstream closed: ${code} ${reason}`);
      this.closeClient(code, reason.toString());
    });

    this.upstream.on('error', (err) => {
      this.log('error', `upstream error: ${err.message}`);
      this.closeClient(1011, 'upstream error');
    });

    // Relay client → upstream (intercept `connect` to inject token)
    this.client.on('message', (data) => {
      if (this.closed || !this.upstream) return;

      const raw = data.toString();
      const modified = this.interceptFrame(raw);
      if (!modified) return; // dropped non-JSON frame

      // Buffer messages until upstream is open
      if (!this.upstreamReady) {
        this.log('debug', 'buffering message (upstream not ready)');
        this.pendingMessages.push(modified);
        return;
      }

      this.upstream.send(modified);
    });

    this.client.on('close', () => {
      this.log('info', 'client disconnected');
      this.closeUpstream();
    });

    this.client.on('error', (err) => {
      this.log('error', `client error: ${err.message}`);
      this.closeUpstream();
    });
  }

  /** Intercept outgoing frames to inject auth token into connect requests */
  private interceptFrame(raw: string): string {
    try {
      const frame = JSON.parse(raw);

      // Only intercept "connect" method requests
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
      return '';
    }
  }

  private closeClient(code: number, reason: string): void {
    if (this.closed) return;
    this.closed = true;
    if (this.client.readyState === WebSocket.OPEN) {
      this.client.close(code, reason);
    }
  }

  private closeUpstream(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.upstream && this.upstream.readyState === WebSocket.OPEN) {
      this.upstream.close();
    }
    this.upstream = null;
  }

  /** Clean up both connections */
  destroy(): void {
    this.closed = true;
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
    this.pendingMessages = [];
    if (this.upstream && this.upstream.readyState !== WebSocket.CLOSED) {
      this.upstream.close();
    }
    this.upstream = null;
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
