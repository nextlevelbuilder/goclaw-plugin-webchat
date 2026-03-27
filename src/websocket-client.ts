// ── GoClaw WebSocket Client (Protocol v3) ──

import type {
  GoClawConfig,
  WsRequest,
  WsResponse,
  WsEvent,
  WsFrame,
  ConnectionState,
  ChatMessage,
  ToolCall,
} from './types';

type EventCallback = (payload: Record<string, unknown>) => void;
type StateCallback = (state: ConnectionState) => void;
type MessageCallback = (message: ChatMessage) => void;

export class GoClawWebSocketClient {
  private ws: WebSocket | null = null;
  private config: GoClawConfig;
  private reqCounter = 0;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRequests = new Map<string, {
    resolve: (value: WsResponse) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  // Event listeners
  private eventListeners = new Map<string, Set<EventCallback>>();
  private stateListeners = new Set<StateCallback>();
  private messageListeners = new Set<MessageCallback>();

  // Current streaming state
  private currentSessionId: string | null = null;
  private streamingMessage: ChatMessage | null = null;

  constructor(config: GoClawConfig) {
    this.config = config;
    this.currentSessionId = config.sessionId ?? null;
  }

  // ── Connection ──

  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') return;
    this.setState('connecting');

    try {
      await this.createAndAuthenticate();
      this.setState('connected');
      this.reconnectAttempts = 0;
      this.config.onConnect?.();
    } catch (err) {
      // Only set disconnected if not already reconnecting
      if (this.state !== 'reconnecting') {
        this.setState('disconnected');
      }
      throw err;
    }
  }

  disconnect(): void {
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect trigger
      this.ws.close();
      this.ws = null;
    }
    this.rejectAllPending('Connection closed');
    this.setState('disconnected');
  }

  getState(): ConnectionState {
    return this.state;
  }

  getSessionId(): string | null {
    return this.currentSessionId;
  }

  // ── RPC Methods ──

  /** Send a chat message and return the request ID for tracking streaming */
  async sendMessage(content: string): Promise<string> {
    const params: Record<string, unknown> = { message: content, stream: true };
    if (this.config.agentId) params.agentId = this.config.agentId;
    if (this.currentSessionId) params.sessionKey = this.currentSessionId;

    // Create user message immediately for optimistic UI
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this.notifyMessage(userMsg);

    // Create placeholder for assistant response
    this.streamingMessage = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
      toolCalls: [],
    };
    this.notifyMessage(this.streamingMessage);

    const res = await this.request('chat.send', params);
    if (!res.ok) {
      // Mark streaming message as failed
      if (this.streamingMessage) {
        this.streamingMessage.streaming = false;
        this.streamingMessage.content = res.error?.message ?? 'Failed to send message';
        this.notifyMessage({ ...this.streamingMessage });
        this.streamingMessage = null;
      }
      throw new Error(res.error?.message ?? 'Failed to send message');
    }

    // Capture session/run ID from response
    if (res.payload?.sessionKey) {
      this.currentSessionId = res.payload.sessionKey as string;
    }

    return res.id;
  }

  /** Abort current agent run */
  async abort(): Promise<void> {
    await this.request('chat.abort', {});
  }

  /** Get chat history for current session */
  async getHistory(): Promise<ChatMessage[]> {
    if (!this.currentSessionId) return [];
    const res = await this.request('chat.history', {
      sessionKey: this.currentSessionId,
    });
    if (!res.ok || !res.payload?.messages) return [];
    return (res.payload.messages as Array<Record<string, unknown>>).map(
      (m, i) => ({
        id: (m.id as string) || `hist_${i}`,
        role: m.role as ChatMessage['role'],
        content: m.content as string,
        timestamp: m.timestamp ? Number(m.timestamp) : Date.now(),
      })
    );
  }

  /** List sessions */
  async listSessions(): Promise<WsResponse> {
    return this.request('sessions.list', {});
  }

  // ── Event System ──

  on(event: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    return () => this.eventListeners.get(event)?.delete(callback);
  }

  onStateChange(callback: StateCallback): () => void {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  onMessage(callback: MessageCallback): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  // ── Private: Connection Lifecycle ──

  /** Create WebSocket, wait for open, then authenticate */
  private createAndAuthenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }

      this.ws.onopen = async () => {
        try {
          await this.authenticate();
          resolve();
        } catch (err) {
          this.ws?.close();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };

      this.ws.onclose = (e) => this.handleClose(e);
      this.ws.onerror = () => {
        reject(new Error('WebSocket connection failed'));
      };
      this.ws.onmessage = (e) => this.handleMessage(e);
    });
  }

  private handleClose(event: CloseEvent): void {
    this.ws = null;
    this.rejectAllPending('Connection lost');

    if (this.config.reconnect !== false && !event.wasClean) {
      this.attemptReconnect();
    } else {
      this.setState('disconnected');
      this.config.onDisconnect?.();
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const frame: WsFrame = JSON.parse(event.data);

      if (frame.type === 'res') {
        this.handleResponse(frame);
      } else if (frame.type === 'event') {
        this.handleEvent(frame);
      }
    } catch {
      // Ignore malformed frames
    }
  }

  private handleResponse(frame: WsResponse): void {
    const pending = this.pendingRequests.get(frame.id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(frame.id);
      pending.resolve(frame);
    }
  }

  private handleEvent(frame: WsEvent): void {
    const outerPayload = frame.payload ?? {};

    // Emit raw event to listeners
    const listeners = this.eventListeners.get(frame.event);
    listeners?.forEach((cb) => cb(outerPayload));

    // GoClaw wraps agent events: { event: "agent", payload: { type: "chunk", payload: { content } } }
    const eventType = frame.event === 'agent'
      ? (outerPayload.type as string) ?? frame.event
      : frame.event;
    const innerPayload = frame.event === 'agent'
      ? (outerPayload.payload as Record<string, unknown>) ?? {}
      : outerPayload;

    // Also emit the unwrapped event type
    if (frame.event === 'agent') {
      this.eventListeners.get(eventType)?.forEach((cb) => cb(innerPayload));
    }

    // Handle streaming events for chat UI
    switch (eventType) {
      case 'chunk':
        if (this.streamingMessage) {
          this.streamingMessage.content += (innerPayload.content as string) || '';
          this.notifyMessage({ ...this.streamingMessage });
        }
        break;

      case 'tool.call':
        if (this.streamingMessage) {
          const toolCall: ToolCall = {
            name: innerPayload.name as string,
            id: innerPayload.id as string,
            status: 'running',
          };
          this.streamingMessage.toolCalls = this.streamingMessage.toolCalls || [];
          this.streamingMessage.toolCalls.push(toolCall);
          this.notifyMessage({ ...this.streamingMessage });
        }
        break;

      case 'tool.result':
        if (this.streamingMessage) {
          const tc = this.streamingMessage.toolCalls?.find(
            (t) => t.id === innerPayload.id
          );
          if (tc) {
            tc.status = 'completed';
            tc.result = innerPayload.result as string;
          }
          this.notifyMessage({ ...this.streamingMessage });
        }
        break;

      case 'run.completed':
        if (this.streamingMessage) {
          this.streamingMessage.streaming = false;
          this.notifyMessage({ ...this.streamingMessage });
          this.streamingMessage = null;
        }
        break;

      case 'run.failed':
        if (this.streamingMessage) {
          this.streamingMessage.streaming = false;
          if (!this.streamingMessage.content) {
            this.streamingMessage.content =
              (innerPayload.error as string) || 'An error occurred.';
          }
          this.notifyMessage({ ...this.streamingMessage });
          this.streamingMessage = null;
        }
        break;
    }
  }

  // ── Private: Auth ──

  private authenticate(): Promise<void> {
    const params: Record<string, unknown> = {
      protocol: 3,
      user_id: this.config.userId || `web_${Date.now()}`,
    };
    // Auth token is injected server-side by the proxy — never sent from client

    return this.request('connect', params).then((res) => {
      if (!res.ok) {
        throw new Error(res.error?.message || 'Authentication failed');
      }
    });
  }

  // ── Private: Request/Response ──

  private request(
    method: string,
    params: Record<string, unknown>,
    timeoutMs = 30000
  ): Promise<WsResponse> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      const id = `req_${++this.reqCounter}_${Date.now()}`;
      const frame: WsRequest = { type: 'req', id, method, params };

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });

      try {
        this.ws.send(JSON.stringify(frame));
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  // ── Private: Reconnect ──

  private attemptReconnect(): void {
    const maxAttempts = this.config.maxReconnectAttempts ?? 10;
    if (this.reconnectAttempts >= maxAttempts) {
      this.setState('disconnected');
      this.config.onDisconnect?.();
      return;
    }

    this.setState('reconnecting');
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s... capped at 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Will trigger handleClose → attemptReconnect again
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ── Private: Helpers ──

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    this.stateListeners.forEach((cb) => cb(state));
  }

  private notifyMessage(message: ChatMessage): void {
    this.messageListeners.forEach((cb) => cb(message));
    this.config.onMessage?.(message);
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
      this.pendingRequests.delete(id);
    }
  }
}
