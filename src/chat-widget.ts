// ── Chat Widget UI (Shadow DOM) ──

import type { GoClawConfig, ChatMessage, ConnectionState, GoClawWidget } from './types';
import { GoClawWebSocketClient } from './websocket-client';
import { resolveTheme } from './styles/theme-variables';
import { WIDGET_CSS } from './styles/widget-styles';
import { ICON_CHAT, ICON_CLOSE, ICON_SEND, ICON_CHECK } from './svg-icons';
import { renderMarkdown } from './markdown-renderer';

const STORAGE_KEY = 'goclaw_webchat_session';

/** Max message length to prevent abuse */
const MAX_MESSAGE_LENGTH = 10000;

export class ChatWidget implements GoClawWidget {
  private config: GoClawConfig;
  private client: GoClawWebSocketClient;
  private host!: HTMLElement;
  private shadow!: ShadowRoot;
  private messages: ChatMessage[] = [];
  private isWindowOpen = false;
  private unreadCount = 0;

  // Cleanup functions for destroy()
  private cleanupFns: Array<() => void> = [];

  // DOM refs (set in buildDOM)
  private launcher!: HTMLButtonElement;
  private window!: HTMLElement;
  private messageList!: HTMLElement;
  private typingIndicator!: HTMLElement;
  private input!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private statusBar!: HTMLElement;
  private statusDot!: HTMLElement;
  private statusText!: HTMLElement;
  private badge!: HTMLElement;

  constructor(config: GoClawConfig) {
    this.config = {
      position: 'bottom-right',
      title: 'Chat with us',
      subtitle: 'Powered by AI',
      placeholder: 'Type a message...',
      reconnect: true,
      maxReconnectAttempts: 10,
      zIndex: 999999,
      ...config,
    };

    // Restore session ID from storage if not explicitly set
    if (!this.config.sessionId) {
      this.config.sessionId = this.loadSessionId() ?? undefined;
    }

    this.client = new GoClawWebSocketClient(this.config);
    this.buildDOM();
    this.bindEvents();
    this.applyTheme();

    // Auto-connect
    this.client.connect().catch((err) => {
      this.config.onError?.(err);
    });

    // Open if configured
    if (this.config.open) {
      requestAnimationFrame(() => this.open());
    }
  }

  // ── Public API ──

  open(): void {
    this.isWindowOpen = true;
    this.unreadCount = 0;
    this.updateBadge();
    this.window.classList.add('gc-visible');
    this.launcher.classList.add('gc-open');
    this.input.focus();
    this.scrollToBottom();
    this.config.onOpen?.();
  }

  close(): void {
    this.isWindowOpen = false;
    this.window.classList.remove('gc-visible');
    this.launcher.classList.remove('gc-open');
    this.config.onClose?.();
  }

  toggle(): void {
    this.isWindowOpen ? this.close() : this.open();
  }

  isOpen(): boolean {
    return this.isWindowOpen;
  }

  async send(message: string): Promise<void> {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      this.config.onError?.(new Error(`Message exceeds ${MAX_MESSAGE_LENGTH} character limit`));
      return;
    }
    try {
      await this.client.sendMessage(trimmed);
      // Persist session ID after successful send
      const sid = this.client.getSessionId();
      if (sid) this.saveSessionId(sid);
    } catch (err) {
      this.config.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  destroy(): void {
    // Run all cleanup functions (event listener removals, etc.)
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    this.client.disconnect();
    this.host.remove();
  }

  update(config: Partial<GoClawConfig>): void {
    Object.assign(this.config, config);
    this.applyTheme();

    if (config.title !== undefined) {
      const titleEl = this.shadow.querySelector('.gc-header-title');
      if (titleEl) titleEl.textContent = config.title;
    }
    if (config.subtitle !== undefined) {
      const subEl = this.shadow.querySelector('.gc-header-subtitle');
      if (subEl) subEl.textContent = config.subtitle;
    }
    if (config.placeholder !== undefined) {
      this.input.placeholder = config.placeholder;
    }
  }

  getConnectionState(): ConnectionState {
    return this.client.getState();
  }

  // ── DOM Construction ──

  private buildDOM(): void {
    this.host = document.createElement('div');
    this.host.id = 'goclaw-webchat';
    this.shadow = this.host.attachShadow({ mode: 'open' });

    const posClass = `gc-pos-${this.config.position}`;

    this.shadow.innerHTML = `
      <style>${WIDGET_CSS}</style>
      ${this.config.customCss ? `<style>${this.config.customCss}</style>` : ''}

      <button class="gc-launcher ${posClass}" aria-label="Open chat">
        ${ICON_CHAT}
        <span class="gc-badge" aria-live="polite"></span>
      </button>

      <div class="gc-window ${posClass}" role="dialog" aria-label="${this.escapeAttr(this.config.title!)}">
        <div class="gc-header">
          ${this.config.agentAvatar
            ? `<img class="gc-header-avatar" src="${this.escapeAttr(this.config.agentAvatar)}" alt="Agent avatar" />`
            : ''
          }
          <div class="gc-header-info">
            <div class="gc-header-title">${this.escapeHtml(this.config.title!)}</div>
            ${this.config.subtitle
              ? `<div class="gc-header-subtitle">${this.escapeHtml(this.config.subtitle)}</div>`
              : ''
            }
          </div>
          <button class="gc-header-close" aria-label="Close chat">
            ${ICON_CLOSE}
          </button>
        </div>

        <div class="gc-status">
          <span class="gc-status-dot gc-disconnected"></span>
          <span class="gc-status-text">Connecting...</span>
        </div>

        <div class="gc-messages" role="log" aria-live="polite">
          ${this.config.welcomeMessage
            ? `<div class="gc-welcome">
                <span class="gc-welcome-icon">💬</span>
                ${this.escapeHtml(this.config.welcomeMessage)}
              </div>`
            : ''
          }
        </div>

        <div class="gc-typing" aria-label="Agent is typing">
          <span class="gc-typing-dot"></span>
          <span class="gc-typing-dot"></span>
          <span class="gc-typing-dot"></span>
        </div>

        <div class="gc-input-area">
          <textarea
            class="gc-input"
            placeholder="${this.escapeAttr(this.config.placeholder!)}"
            rows="1"
            aria-label="Message input"
          ></textarea>
          <button class="gc-send-btn" aria-label="Send message" disabled>
            ${ICON_SEND}
          </button>
        </div>

        <div class="gc-powered">
          Powered by <a href="https://goclaw.sh" target="_blank" rel="noopener">GoClaw</a>
        </div>
      </div>
    `;

    // Cache DOM refs
    this.launcher = this.shadow.querySelector('.gc-launcher')!;
    this.window = this.shadow.querySelector('.gc-window')!;
    this.messageList = this.shadow.querySelector('.gc-messages')!;
    this.typingIndicator = this.shadow.querySelector('.gc-typing')!;
    this.input = this.shadow.querySelector('.gc-input')!;
    this.sendBtn = this.shadow.querySelector('.gc-send-btn')!;
    this.statusBar = this.shadow.querySelector('.gc-status')!;
    this.statusDot = this.shadow.querySelector('.gc-status-dot')!;
    this.statusText = this.shadow.querySelector('.gc-status-text')!;
    this.badge = this.shadow.querySelector('.gc-badge')!;

    // Mount to container
    const container = this.config.container ?? document.body;
    container.appendChild(this.host);
  }

  // ── Event Binding ──

  private bindEvents(): void {
    this.launcher.addEventListener('click', () => this.toggle());

    this.shadow.querySelector('.gc-header-close')!
      .addEventListener('click', () => this.close());

    // Input: enable/disable send, auto-resize
    this.input.addEventListener('input', () => {
      this.sendBtn.disabled = !this.input.value.trim();
      this.autoResize();
    });

    // Enter to send (Shift+Enter for newline)
    this.input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Escape to close
    this.window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close();
    });

    this.sendBtn.addEventListener('click', () => this.handleSend());

    // WebSocket events — store unsubscribers for cleanup
    this.cleanupFns.push(
      this.client.onMessage((msg) => this.handleMessage(msg)),
      this.client.onStateChange((state) => this.handleStateChange(state)),
      this.client.on('run.started', () => {
        this.typingIndicator.classList.add('gc-show');
        this.scrollToBottom();
      }),
      this.client.on('run.completed', () => {
        this.typingIndicator.classList.remove('gc-show');
      }),
      this.client.on('run.failed', () => {
        this.typingIndicator.classList.remove('gc-show');
      }),
    );

    // Auto-theme switching for 'auto' mode
    if (this.config.theme === 'auto' || !this.config.theme) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => this.applyTheme();
      mql.addEventListener('change', handler);
      this.cleanupFns.push(() => mql.removeEventListener('change', handler));
    }
  }

  // ── Message Handling ──

  private handleSend(): void {
    const text = this.input.value.trim();
    if (!text) return;

    this.input.value = '';
    this.sendBtn.disabled = true;
    this.autoResize();
    this.send(text);
  }

  private handleMessage(msg: ChatMessage): void {
    const existing = this.messages.findIndex((m) => m.id === msg.id);
    if (existing >= 0) {
      this.messages[existing] = msg;
      this.updateMessageElement(msg);
    } else {
      this.messages.push(msg);
      this.appendMessageElement(msg);

      // Increment unread if chat is closed and message is from assistant (non-streaming start)
      if (!this.isWindowOpen && msg.role === 'assistant' && !msg.streaming) {
        this.unreadCount++;
        this.updateBadge();
      }
    }

    // Track unread for completed assistant streaming messages
    if (!this.isWindowOpen && msg.role === 'assistant' && msg.streaming === false) {
      // Only count once when streaming finishes (content > 0 means real message)
      if (msg.content && existing >= 0) {
        this.unreadCount++;
        this.updateBadge();
      }
    }

    // Remove welcome message on first real message
    const welcome = this.shadow.querySelector('.gc-welcome');
    if (welcome) welcome.remove();

    this.scrollToBottom();
  }

  private appendMessageElement(msg: ChatMessage): void {
    const el = this.createMessageElement(msg);
    this.messageList.appendChild(el);
  }

  private updateMessageElement(msg: ChatMessage): void {
    const el = this.findMessageElement(msg.id);
    if (!el) return;

    // Update rendered content
    const contentEl = el.querySelector('.gc-msg-content');
    if (contentEl && msg.role === 'assistant') {
      contentEl.innerHTML = renderMarkdown(msg.content);
    }

    // Update tool call indicators
    if (msg.toolCalls?.length) {
      let toolContainer = el.querySelector('.gc-msg-tools');
      if (!toolContainer) {
        toolContainer = document.createElement('div');
        toolContainer.className = 'gc-msg-tools';
        el.appendChild(toolContainer);
      }
      toolContainer.innerHTML = msg.toolCalls
        .map((tc) => `
          <div class="gc-tool">
            ${tc.status === 'running'
              ? '<span class="gc-tool-spinner"></span>'
              : `<span class="gc-tool-check">${ICON_CHECK}</span>`
            }
            <span>${this.escapeHtml(tc.name)}</span>
          </div>
        `).join('');
    }

    if (!msg.streaming) {
      el.classList.remove('gc-streaming');
    }
  }

  private createMessageElement(msg: ChatMessage): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-msg-id', msg.id);

    if (msg.role === 'user') {
      wrapper.className = 'gc-msg gc-msg-user';
      wrapper.textContent = msg.content;
    } else if (msg.role === 'assistant') {
      wrapper.className = `gc-msg gc-msg-assistant ${msg.streaming ? 'gc-streaming' : ''}`;
      const content = document.createElement('div');
      content.className = 'gc-msg-content';
      content.innerHTML = renderMarkdown(msg.content);
      wrapper.appendChild(content);
    }

    return wrapper;
  }

  // ── Connection State ──

  private handleStateChange(state: ConnectionState): void {
    this.statusDot.className = `gc-status-dot gc-${state}`;

    const labels: Record<ConnectionState, string> = {
      connected: 'Connected',
      connecting: 'Connecting...',
      reconnecting: 'Reconnecting...',
      disconnected: 'Disconnected',
    };
    this.statusText.textContent = labels[state];

    if (state === 'connected') {
      this.statusBar.classList.add('gc-show');
      setTimeout(() => this.statusBar.classList.remove('gc-show'), 2000);
    } else {
      this.statusBar.classList.add('gc-show');
    }

    // Disable input when not connected
    const canSend = state === 'connected';
    this.input.disabled = !canSend;
    if (!canSend) this.sendBtn.disabled = true;
  }

  // ── Unread Badge ──

  private updateBadge(): void {
    if (this.unreadCount > 0) {
      this.badge.textContent = this.unreadCount > 99 ? '99+' : String(this.unreadCount);
      this.badge.classList.add('gc-show');
    } else {
      this.badge.textContent = '';
      this.badge.classList.remove('gc-show');
    }
  }

  // ── Session Persistence ──

  private saveSessionId(sessionId: string): void {
    try {
      const key = this.storageKey();
      sessionStorage.setItem(key, sessionId);
    } catch {
      // sessionStorage unavailable (e.g. incognito in some browsers)
    }
  }

  private loadSessionId(): string | null {
    try {
      return sessionStorage.getItem(this.storageKey());
    } catch {
      return null;
    }
  }

  private storageKey(): string {
    // Scope storage key by URL to avoid cross-site collisions
    return `${STORAGE_KEY}_${this.config.url}`;
  }

  // ── Theme ──

  private applyTheme(): void {
    const vars = resolveTheme(this.config.theme);
    if (this.config.zIndex) {
      vars['--gc-z-index'] = String(this.config.zIndex);
    }

    const cssText = Object.entries(vars)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');

    this.host.style.cssText = cssText;
  }

  // ── Helpers ──

  /** Safe message element lookup — avoids querySelector injection from server-controlled IDs */
  private findMessageElement(id: string): Element | null {
    const children = this.messageList.children;
    for (let i = children.length - 1; i >= 0; i--) {
      if (children[i].getAttribute('data-msg-id') === id) return children[i];
    }
    return null;
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      this.messageList.scrollTop = this.messageList.scrollHeight;
    });
  }

  private autoResize(): void {
    this.input.style.height = 'auto';
    this.input.style.height = Math.min(this.input.scrollHeight, 120) + 'px';
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  private escapeAttr(str: string): string {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
