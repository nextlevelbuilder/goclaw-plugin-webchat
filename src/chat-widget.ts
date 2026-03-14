// ── Chat Widget UI (Shadow DOM) ──

import type { GoClawConfig, ChatMessage, ConnectionState, GoClawWidget } from './types';
import { GoClawWebSocketClient } from './websocket-client';
import { resolveTheme } from './styles/theme-variables';
import { WIDGET_CSS } from './styles/widget-styles';
import { ICON_CHAT, ICON_CLOSE, ICON_SEND, ICON_CHECK } from './svg-icons';
import { renderMarkdown } from './markdown-renderer';

export class ChatWidget implements GoClawWidget {
  private config: GoClawConfig;
  private client: GoClawWebSocketClient;
  private host!: HTMLElement;
  private shadow!: ShadowRoot;
  private messages: ChatMessage[] = [];
  private isWindowOpen = false;

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
    if (!message.trim()) return;
    try {
      await this.client.sendMessage(message.trim());
    } catch (err) {
      this.config.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  destroy(): void {
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
    // Host element
    this.host = document.createElement('div');
    this.host.id = 'goclaw-webchat';
    this.shadow = this.host.attachShadow({ mode: 'open' });

    const posClass = `gc-pos-${this.config.position}`;

    this.shadow.innerHTML = `
      <style>${WIDGET_CSS}</style>
      ${this.config.customCss ? `<style>${this.config.customCss}</style>` : ''}

      <button class="gc-launcher ${posClass}" aria-label="Open chat">
        ${ICON_CHAT}
      </button>

      <div class="gc-window ${posClass}">
        <div class="gc-header">
          ${this.config.agentAvatar
            ? `<img class="gc-header-avatar" src="${this.escapeAttr(this.config.agentAvatar)}" alt="Agent" />`
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

        <div class="gc-messages">
          ${this.config.welcomeMessage
            ? `<div class="gc-welcome">
                <span class="gc-welcome-icon">💬</span>
                ${this.escapeHtml(this.config.welcomeMessage)}
              </div>`
            : ''
          }
        </div>

        <div class="gc-typing">
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

    // Cache refs
    this.launcher = this.shadow.querySelector('.gc-launcher')!;
    this.window = this.shadow.querySelector('.gc-window')!;
    this.messageList = this.shadow.querySelector('.gc-messages')!;
    this.typingIndicator = this.shadow.querySelector('.gc-typing')!;
    this.input = this.shadow.querySelector('.gc-input')!;
    this.sendBtn = this.shadow.querySelector('.gc-send-btn')!;
    this.statusBar = this.shadow.querySelector('.gc-status')!;
    this.statusDot = this.shadow.querySelector('.gc-status-dot')!;
    this.statusText = this.shadow.querySelector('.gc-status-text')!;

    // Mount
    const container = this.config.container ?? document.body;
    container.appendChild(this.host);
  }

  // ── Event Binding ──

  private bindEvents(): void {
    // Launcher click
    this.launcher.addEventListener('click', () => this.toggle());

    // Close button
    this.shadow.querySelector('.gc-header-close')!
      .addEventListener('click', () => this.close());

    // Input handling
    this.input.addEventListener('input', () => {
      this.sendBtn.disabled = !this.input.value.trim();
      this.autoResize();
    });

    this.input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Send button
    this.sendBtn.addEventListener('click', () => this.handleSend());

    // WebSocket events
    this.client.onMessage((msg) => this.handleMessage(msg));
    this.client.onStateChange((state) => this.handleStateChange(state));

    // Listen for run.started to show typing
    this.client.on('run.started', () => {
      this.typingIndicator.classList.add('gc-show');
      this.scrollToBottom();
    });

    // Listen for run.completed/failed to hide typing
    this.client.on('run.completed', () => {
      this.typingIndicator.classList.remove('gc-show');
    });

    this.client.on('run.failed', () => {
      this.typingIndicator.classList.remove('gc-show');
    });

    // Auto-theme switching
    if (this.config.theme === 'auto' || (!this.config.theme)) {
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => this.applyTheme());
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
    }

    // Remove welcome message on first real message
    const welcome = this.shadow.querySelector('.gc-welcome');
    if (welcome) welcome.remove();

    this.scrollToBottom();
  }

  private appendMessageElement(msg: ChatMessage): void {
    const el = this.createMessageElement(msg);
    // Insert before typing indicator's parent (messages container)
    this.messageList.appendChild(el);
  }

  private updateMessageElement(msg: ChatMessage): void {
    const el = this.shadow.querySelector(`[data-msg-id="${msg.id}"]`);
    if (!el) return;

    // Update content
    const contentEl = el.querySelector('.gc-msg-content');
    if (contentEl && msg.role === 'assistant') {
      contentEl.innerHTML = renderMarkdown(msg.content);
    }

    // Update tool calls
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

    // Remove streaming cursor when done
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
    // Update status dot
    this.statusDot.className = `gc-status-dot gc-${state}`;

    const labels: Record<ConnectionState, string> = {
      connected: 'Connected',
      connecting: 'Connecting...',
      reconnecting: 'Reconnecting...',
      disconnected: 'Disconnected',
    };
    this.statusText.textContent = labels[state];

    // Show status bar only when not connected
    if (state === 'connected') {
      // Show briefly then hide
      this.statusBar.classList.add('gc-show');
      setTimeout(() => this.statusBar.classList.remove('gc-show'), 2000);
    } else {
      this.statusBar.classList.add('gc-show');
    }

    // Disable input when disconnected
    this.input.disabled = state === 'disconnected';
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
