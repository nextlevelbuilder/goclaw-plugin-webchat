# @goclaw/webchat

Embeddable chat widget for [GoClaw](https://goclaw.sh) AI agent gateway. Drop a `<script>` tag on any website and let visitors chat with your AI agents — like Intercom, but for GoClaw.

## Architecture

The widget connects through a **proxy server** that keeps the gateway auth token server-side. The token is never exposed to the browser.

```
Browser Widget ←→ Proxy Server (:3100) ←→ GoClaw Gateway (:9090)
  (no token)      (holds token)           (validates token)
```

## Features

- **Zero dependencies** — Vanilla TypeScript, ~8KB gzipped
- **Secure by default** — Auth token never leaves the server
- **Shadow DOM isolation** — Styles never leak into or from host page
- **Framework-agnostic** — Works with React, Vue, Angular, or plain HTML
- **Real-time streaming** — Token-by-token LLM responses via WebSocket
- **Theming** — Light, dark, auto, or fully custom via CSS variables
- **Configurable** — Position, size, colors, fonts, avatars, everything
- **Auto-reconnect** — Exponential backoff with configurable retries
- **Async loading** — Non-blocking snippet pattern (like Intercom)
- **Mobile responsive** — Full-screen on small viewports
- **Accessible** — Keyboard navigation, ARIA labels

## Proxy Server Setup

```bash
cd server/
cp .env.example .env
# Edit .env: set GOCLAW_URL, GOCLAW_TOKEN, and optionally PROXY_API_KEY
npm install
npm run dev
```

## Quick Start

### Script Tag (simplest)

```html
<script src="https://cdn.example.com/goclaw-webchat.umd.js"></script>
<script>
  GoClaw.init({
    url: 'wss://proxy.example.com/ws',
    title: 'Chat with us',
    theme: 'auto',
  });
</script>
```

### Async Snippet (non-blocking)

```html
<script>
  (function(w,d,s,u){
    w.__goclaw_queue=w.__goclaw_queue||[];
    w.GoClaw=w.GoClaw||{init:function(){w.__goclaw_queue.push(['init',arguments[0]])}};
    var f=d.getElementsByTagName(s)[0],j=d.createElement(s);
    j.async=true;j.src=u;f.parentNode.insertBefore(j,f);
  })(window,document,'script','https://cdn.example.com/goclaw-webchat.umd.js');

  GoClaw.init({
    url: 'wss://proxy.example.com/ws',
    title: 'Support',
    theme: 'auto',
  });
</script>
```

### NPM / ESM

```bash
npm install @goclaw/webchat
```

```ts
import { init } from '@goclaw/webchat';

const widget = init({
  url: 'wss://proxy.example.com/ws',
  title: 'AI Assistant',
  theme: 'dark',
});

// Programmatic control
widget.open();
widget.send('Hello!');
widget.close();
widget.destroy();
```

### React

```tsx
import { GoClawChat } from '@goclaw/webchat/react';

function App() {
  return (
    <GoClawChat
      url="wss://proxy.example.com/ws"
      title="Support"
      theme="auto"
    />
  );
}
```

### Vue 3

```ts
import { GoClawPlugin } from '@goclaw/webchat/vue';

app.use(GoClawPlugin, {
  url: 'wss://proxy.example.com/ws',
  title: 'AI Assistant',
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | *required* | Proxy server WebSocket URL (`wss://...`) |
| `apiKey` | `string` | — | API key for proxy authentication |
| `userId` | `string` | auto-generated | User identifier |
| `agentId` | `string` | — | Specific agent to chat with |
| `sessionId` | `string` | — | Resume a previous session |
| `theme` | `'light' \| 'dark' \| 'auto' \| ThemeOverrides` | `'light'` | Theme configuration |
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Widget position |
| `title` | `string` | `'Chat with us'` | Header title |
| `subtitle` | `string` | — | Header subtitle |
| `placeholder` | `string` | `'Type a message...'` | Input placeholder |
| `welcomeMessage` | `string` | — | Initial message shown |
| `agentAvatar` | `string` | — | Avatar image URL |
| `open` | `boolean` | `false` | Start with chat open |
| `customCss` | `string` | — | Extra CSS for Shadow DOM |
| `reconnect` | `boolean` | `true` | Auto-reconnect on disconnect |
| `maxReconnectAttempts` | `number` | `10` | Max reconnection attempts |
| `zIndex` | `number` | `999999` | CSS z-index |

## Custom Themes

```js
GoClaw.init({
  url: 'wss://proxy.example.com/ws',
  theme: {
    base: 'dark',
    primaryColor: '#8b5cf6',
    userBubbleColor: '#8b5cf6',
    backgroundColor: '#0f172a',
    fontFamily: '"Inter", sans-serif',
    borderRadius: '12px',
    width: '420px',
    height: '650px',
  },
});
```

## Programmatic API

```ts
const widget = GoClaw.init({ ... });

widget.open();                    // Open chat window
widget.close();                   // Close chat window
widget.toggle();                  // Toggle open/close
widget.send('Hello');             // Send a message
widget.isOpen();                  // Check if open
widget.getConnectionState();      // 'connected' | 'connecting' | ...
widget.update({ title: 'New' }); // Update config
widget.destroy();                 // Remove widget & disconnect
```

## Event Callbacks

```js
GoClaw.init({
  url: 'wss://proxy.example.com/ws',
  onOpen: () => console.log('Chat opened'),
  onClose: () => console.log('Chat closed'),
  onMessage: (msg) => console.log('Message:', msg),
  onConnect: () => console.log('WebSocket connected'),
  onDisconnect: () => console.log('WebSocket disconnected'),
  onError: (err) => console.error('Error:', err),
});
```

## GoClaw Server Setup

1. Ensure your GoClaw server has WebSocket enabled (default on `/ws`)
2. Add the **proxy server's** origin to `allowed_origins` in GoClaw config:

```json
{
  "gateway": {
    "allowed_origins": ["https://your-proxy-server.com"]
  }
}
```

3. Configure the gateway token in the proxy server's `.env` file

## Development

```bash
npm install
npm run dev      # Dev server with HMR
npm run build    # Production build
npm run lint     # Type-check
```

## License

MIT
