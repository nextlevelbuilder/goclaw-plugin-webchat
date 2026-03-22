// ── GoClaw WebSocket Protocol v3 Types ──

export interface GoClawConfig {
  /** Proxy server WebSocket URL (e.g., "wss://proxy.example.com/ws").
   * The proxy keeps the gateway auth token server-side — never exposed to the client. */
  url: string;
  /** API key for proxy authentication (appended as ?apiKey=xxx to url) */
  apiKey?: string;
  /** User identifier */
  userId?: string;
  /** Agent ID to chat with (optional, uses default agent if omitted) */
  agentId?: string;
  /** Session ID to resume a conversation */
  sessionId?: string;
  /** Theme: 'light' | 'dark' | 'auto' | custom theme object */
  theme?: ThemeName | ThemeOverrides;
  /** Widget position on screen */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Widget title shown in header */
  title?: string;
  /** Subtitle / description */
  subtitle?: string;
  /** Placeholder text for input field */
  placeholder?: string;
  /** Welcome message shown when chat is empty */
  welcomeMessage?: string;
  /** Avatar URL for the agent */
  agentAvatar?: string;
  /** Whether to start with chat open */
  open?: boolean;
  /** Launcher icon: 'chat' | 'message' | custom SVG string */
  launcherIcon?: string;
  /** Custom CSS to inject into Shadow DOM */
  customCss?: string;
  /** Enable sound notifications */
  sound?: boolean;
  /** Auto-reconnect on disconnect */
  reconnect?: boolean;
  /** Max reconnect attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Container element to mount into (default: document.body) */
  container?: HTMLElement;
  /** Z-index for the widget (default: 999999) */
  zIndex?: number;
  /** Locale for i18n (default: 'en') */
  locale?: string;
  /** Callback hooks */
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export type ThemeName = 'light' | 'dark' | 'auto';

export interface ThemeOverrides {
  /** Base theme to extend */
  base?: ThemeName;
  /** Primary brand color */
  primaryColor?: string;
  /** Text color on primary */
  primaryTextColor?: string;
  /** Background color of chat window */
  backgroundColor?: string;
  /** Text color */
  textColor?: string;
  /** User message bubble color */
  userBubbleColor?: string;
  /** User message text color */
  userTextColor?: string;
  /** Agent message bubble color */
  agentBubbleColor?: string;
  /** Agent message text color */
  agentTextColor?: string;
  /** Input background color */
  inputBackgroundColor?: string;
  /** Border radius */
  borderRadius?: string;
  /** Font family */
  fontFamily?: string;
  /** Font size */
  fontSize?: string;
  /** Header height */
  headerHeight?: string;
  /** Widget width */
  width?: string;
  /** Widget height */
  height?: string;
  /** Launcher button size */
  launcherSize?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** True if message is still being streamed */
  streaming?: boolean;
  /** Tool calls associated with this message */
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  id: string;
  status: 'running' | 'completed' | 'failed';
  result?: string;
}

// ── WebSocket Protocol v3 Frame Types ──

export interface WsRequest {
  type: 'req';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface WsResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: { code: string; message: string };
}

export interface WsEvent {
  type: 'event';
  event: string;
  payload?: Record<string, unknown>;
}

export type WsFrame = WsRequest | WsResponse | WsEvent;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface GoClawWidget {
  /** Open the chat window */
  open(): void;
  /** Close the chat window */
  close(): void;
  /** Toggle chat window */
  toggle(): void;
  /** Send a message programmatically */
  send(message: string): void;
  /** Destroy the widget and disconnect */
  destroy(): void;
  /** Update configuration */
  update(config: Partial<GoClawConfig>): void;
  /** Check if chat window is open */
  isOpen(): boolean;
  /** Get connection state */
  getConnectionState(): ConnectionState;
}
