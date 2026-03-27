/**
 * Vue 3 Integration Example (Proxy Mode)
 *
 * Prerequisites:
 *   1. Start the proxy server: cd server && npm run dev
 *   2. npm install @goclaw/webchat
 *
 * The proxy server keeps the auth token server-side.
 * The widget only needs the proxy URL — no token required.
 *
 * In your main.ts:
 */

import { createApp } from 'vue';
// import App from './App.vue';
import { GoClawPlugin } from '@goclaw/webchat/vue';

const app = createApp({ template: '<div>App</div>' });

app.use(GoClawPlugin, {
  url: 'wss://proxy.example.com/ws',
  title: 'AI Assistant',
  subtitle: 'Online',
  theme: 'auto',
  welcomeMessage: 'Hello! How can I assist you today?',
  position: 'bottom-right',
});

app.mount('#app');

/**
 * In any component, access via inject:
 *
 * <script setup lang="ts">
 * import { inject } from 'vue';
 * import type { GoClawWidget } from '@goclaw/webchat';
 *
 * const chat = inject<GoClawWidget>('goclaw-webchat');
 *
 * function openChat() {
 *   chat?.open();
 * }
 * </script>
 */
