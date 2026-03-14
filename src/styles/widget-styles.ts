// ── Shadow DOM Stylesheet ──
// All styles scoped inside Shadow DOM, using CSS custom properties for theming

export const WIDGET_CSS = /* css */ `
  :host {
    all: initial;
    font-family: var(--gc-font);
    font-size: var(--gc-font-size);
    color: var(--gc-text);
    line-height: 1.5;
    box-sizing: border-box;
  }

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* ── Launcher Button ── */
  .gc-launcher {
    position: fixed;
    z-index: var(--gc-z-index);
    width: var(--gc-launcher-size);
    height: var(--gc-launcher-size);
    border-radius: 50%;
    background: var(--gc-primary);
    color: var(--gc-primary-text);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s ease, background 0.2s ease;
    outline: none;
  }

  .gc-launcher:hover {
    background: var(--gc-primary-hover);
    transform: scale(1.05);
  }

  .gc-launcher:active {
    transform: scale(0.95);
  }

  .gc-launcher svg {
    width: 28px;
    height: 28px;
    fill: currentColor;
    transition: transform 0.3s ease;
  }

  .gc-launcher.gc-open svg {
    transform: rotate(90deg);
  }

  /* ── Unread Badge ── */
  .gc-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: #ef4444;
    color: #ffffff;
    font-size: 11px;
    font-weight: 700;
    line-height: 20px;
    text-align: center;
    display: none;
    pointer-events: none;
    animation: gc-badgePop 0.3s ease;
  }

  .gc-badge.gc-show {
    display: block;
  }

  @keyframes gc-badgePop {
    0% { transform: scale(0); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }

  /* Position variants */
  .gc-pos-bottom-right { bottom: 20px; right: 20px; }
  .gc-pos-bottom-left  { bottom: 20px; left: 20px; }
  .gc-pos-top-right    { top: 20px; right: 20px; }
  .gc-pos-top-left     { top: 20px; left: 20px; }

  /* ── Chat Window ── */
  .gc-window {
    position: fixed;
    z-index: var(--gc-z-index);
    width: var(--gc-width);
    height: var(--gc-height);
    max-height: calc(100vh - 100px);
    max-width: calc(100vw - 32px);
    background: var(--gc-bg);
    border-radius: var(--gc-radius);
    box-shadow: var(--gc-shadow);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
    transform: translateY(16px) scale(0.95);
    pointer-events: none;
    transition: opacity 0.25s ease, transform 0.25s ease;
    border: 1px solid var(--gc-border);
  }

  .gc-window.gc-visible {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }

  /* Window position relative to launcher */
  .gc-window.gc-pos-bottom-right { bottom: 90px; right: 20px; }
  .gc-window.gc-pos-bottom-left  { bottom: 90px; left: 20px; }
  .gc-window.gc-pos-top-right    { top: 90px; right: 20px; }
  .gc-window.gc-pos-top-left     { top: 90px; left: 20px; }

  /* ── Header ── */
  .gc-header {
    height: var(--gc-header-height);
    background: var(--gc-primary);
    color: var(--gc-primary-text);
    display: flex;
    align-items: center;
    padding: 0 16px;
    flex-shrink: 0;
    gap: 12px;
  }

  .gc-header-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .gc-header-info {
    flex: 1;
    min-width: 0;
  }

  .gc-header-title {
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .gc-header-subtitle {
    font-size: 12px;
    opacity: 0.85;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .gc-header-close {
    background: none;
    border: none;
    color: var(--gc-primary-text);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.8;
    transition: opacity 0.15s;
  }

  .gc-header-close:hover {
    opacity: 1;
    background: rgba(255,255,255,0.15);
  }

  .gc-header-close svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  /* ── Connection Status ── */
  .gc-status {
    padding: 6px 16px;
    font-size: 12px;
    text-align: center;
    background: var(--gc-bg-secondary);
    color: var(--gc-text-secondary);
    border-bottom: 1px solid var(--gc-border);
    display: none;
  }

  .gc-status.gc-show {
    display: block;
  }

  .gc-status-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
    vertical-align: middle;
  }

  .gc-status-dot.gc-connected    { background: #22c55e; }
  .gc-status-dot.gc-connecting   { background: #eab308; animation: gc-pulse 1s infinite; }
  .gc-status-dot.gc-reconnecting { background: #eab308; animation: gc-pulse 1s infinite; }
  .gc-status-dot.gc-disconnected { background: #ef4444; }

  @keyframes gc-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* ── Messages Area ── */
  .gc-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--gc-bg);
    scroll-behavior: smooth;
    overscroll-behavior: contain;
  }

  .gc-messages::-webkit-scrollbar {
    width: 6px;
  }

  .gc-messages::-webkit-scrollbar-track {
    background: transparent;
  }

  .gc-messages::-webkit-scrollbar-thumb {
    background: var(--gc-border);
    border-radius: 3px;
  }

  /* ── Welcome Message ── */
  .gc-welcome {
    text-align: center;
    padding: 32px 16px;
    color: var(--gc-text-secondary);
    font-size: 14px;
    line-height: 1.6;
  }

  .gc-welcome-icon {
    font-size: 40px;
    margin-bottom: 12px;
    display: block;
  }

  /* ── Message Bubbles ── */
  .gc-msg {
    max-width: 85%;
    padding: 10px 14px;
    border-radius: var(--gc-radius-msg);
    word-wrap: break-word;
    white-space: pre-wrap;
    font-size: var(--gc-font-size);
    line-height: 1.5;
    animation: gc-fadeIn 0.2s ease;
  }

  @keyframes gc-fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .gc-msg-user {
    align-self: flex-end;
    background: var(--gc-user-bubble);
    color: var(--gc-user-text);
    border-bottom-right-radius: 4px;
  }

  .gc-msg-assistant {
    align-self: flex-start;
    background: var(--gc-agent-bubble);
    color: var(--gc-agent-text);
    border-bottom-left-radius: 4px;
  }

  /* Markdown basics inside messages */
  .gc-msg code {
    background: rgba(0,0,0,0.1);
    padding: 1px 4px;
    border-radius: 4px;
    font-size: 0.9em;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
  }

  .gc-msg pre {
    background: rgba(0,0,0,0.08);
    padding: 8px 10px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 6px 0;
    font-size: 0.85em;
  }

  .gc-msg pre code {
    background: none;
    padding: 0;
  }

  .gc-msg a {
    color: inherit;
    text-decoration: underline;
  }

  .gc-msg strong { font-weight: 600; }
  .gc-msg em { font-style: italic; }

  .gc-msg ul, .gc-msg ol {
    padding-left: 20px;
    margin: 4px 0;
  }

  /* ── Tool Calls ── */
  .gc-tool {
    font-size: 12px;
    padding: 6px 10px;
    background: var(--gc-bg-secondary);
    border: 1px solid var(--gc-border);
    border-radius: 8px;
    color: var(--gc-text-secondary);
    align-self: flex-start;
    max-width: 85%;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .gc-tool-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--gc-border);
    border-top-color: var(--gc-primary);
    border-radius: 50%;
    animation: gc-spin 0.6s linear infinite;
  }

  @keyframes gc-spin {
    to { transform: rotate(360deg); }
  }

  .gc-tool-check {
    color: #22c55e;
  }

  /* ── Typing Indicator ── */
  .gc-typing {
    align-self: flex-start;
    padding: 12px 16px;
    background: var(--gc-agent-bubble);
    border-radius: var(--gc-radius-msg);
    border-bottom-left-radius: 4px;
    display: none;
    gap: 4px;
  }

  .gc-typing.gc-show {
    display: flex;
  }

  .gc-typing-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--gc-text-secondary);
    animation: gc-bounce 1.4s infinite ease-in-out;
  }

  .gc-typing-dot:nth-child(1) { animation-delay: 0s; }
  .gc-typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .gc-typing-dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes gc-bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* ── Input Area ── */
  .gc-input-area {
    display: flex;
    align-items: flex-end;
    padding: 12px 16px;
    gap: 8px;
    border-top: 1px solid var(--gc-border);
    background: var(--gc-bg);
    flex-shrink: 0;
  }

  .gc-input {
    flex: 1;
    min-height: 40px;
    max-height: 120px;
    padding: 8px 12px;
    border: 1px solid var(--gc-input-border);
    border-radius: 12px;
    background: var(--gc-input-bg);
    color: var(--gc-text);
    font-family: var(--gc-font);
    font-size: var(--gc-font-size);
    resize: none;
    outline: none;
    overflow-y: auto;
    line-height: 1.4;
    transition: border-color 0.15s;
  }

  .gc-input:focus {
    border-color: var(--gc-input-focus);
  }

  .gc-input::placeholder {
    color: var(--gc-text-secondary);
  }

  .gc-send-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--gc-primary);
    color: var(--gc-primary-text);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s, opacity 0.15s;
  }

  .gc-send-btn:hover {
    background: var(--gc-primary-hover);
  }

  .gc-send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .gc-send-btn svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  /* ── Powered By ── */
  .gc-powered {
    text-align: center;
    padding: 6px;
    font-size: 11px;
    color: var(--gc-text-secondary);
    background: var(--gc-bg-secondary);
    border-top: 1px solid var(--gc-border);
  }

  .gc-powered a {
    color: var(--gc-primary);
    text-decoration: none;
  }

  /* ── Mobile responsive ── */
  @media (max-width: 480px) {
    .gc-window {
      width: 100vw;
      height: 100vh;
      max-height: 100vh;
      max-width: 100vw;
      border-radius: 0;
      bottom: 0 !important;
      right: 0 !important;
      left: 0 !important;
      top: 0 !important;
    }
  }
`;
