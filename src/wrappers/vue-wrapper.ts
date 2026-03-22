// ── Vue 3 plugin for GoClaw WebChat ──

import type { App, Plugin } from 'vue';
import type { GoClawConfig, GoClawWidget } from '../types';
import { ChatWidget } from '../chat-widget';

export interface GoClawPluginOptions extends GoClawConfig {}

let widgetInstance: GoClawWidget | null = null;

/**
 * Vue 3 plugin for GoClaw WebChat.
 *
 * Usage:
 * ```ts
 * import { createApp } from 'vue';
 * import { GoClawPlugin } from '@goclaw/webchat/vue';
 *
 * const app = createApp(App);
 * app.use(GoClawPlugin, {
 *   url: 'wss://proxy.example.com/ws',
 *   title: 'Support',
 * });
 * ```
 */
export const GoClawPlugin: Plugin = {
  install(app: App, options: GoClawPluginOptions) {
    widgetInstance = new ChatWidget(options);

    // Provide widget instance globally
    app.provide('goclaw-webchat', widgetInstance);

    // Also add to global properties
    app.config.globalProperties.$goclawChat = widgetInstance;
  },
};

/** Get the current widget instance (for use outside components) */
export function getGoClawWidget(): GoClawWidget | null {
  return widgetInstance;
}
