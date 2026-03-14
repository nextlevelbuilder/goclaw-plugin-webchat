/**
 * Vue 3 Integration Example
 *
 * Install:
 *   npm install @goclaw/webchat
 *
 * In your main.ts:
 */

import { createApp } from 'vue';
// import App from './App.vue';
import { GoClawPlugin } from '@goclaw/webchat/vue';

const app = createApp({ template: '<div>App</div>' });

app.use(GoClawPlugin, {
  url: 'wss://goclaw.example.com/ws',
  token: 'your-gateway-token',
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
