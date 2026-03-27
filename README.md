# @goclaw/webchat

Embeddable chat widget for [GoClaw](https://goclaw.sh) AI agent gateway. Drop a `<script>` tag on any website and let visitors chat with your AI agents — like Intercom, but for GoClaw.

## Architecture

The widget connects through a **proxy server** that keeps the gateway auth token server-side. The token is never exposed to the browser.

```
Browser Widget ←→ Proxy Server (:3100) ←→ GoClaw Gateway
  (no token)      (injects token)         (validates token)
```

## Features

- **Zero dependencies** — Vanilla TypeScript, ~18KB gzipped
- **Secure by default** — Auth token never leaves the server
- **Shadow DOM isolation** — Styles never leak into or from host page
- **Framework-agnostic** — Works with React, Vue, Angular, or plain HTML
- **Real-time streaming** — Token-by-token LLM responses via WebSocket
- **Theming** — Light, dark, auto, or fully custom via CSS variables
- **Auto-reconnect** — Exponential backoff with configurable retries
- **Async loading** — Non-blocking snippet pattern (like Intercom)

## Getting Started

### Step 1: Clone & install

```bash
git clone https://github.com/nextlevelbuilder/goclaw-plugin-webchat.git
cd goclaw-plugin-webchat
npm install
```

### Step 2: Configure the proxy server

The proxy keeps your GoClaw gateway token server-side. Create a `.env` file:

```bash
cd server
cp .env.example .env
```

Edit `server/.env` with your GoClaw credentials:

```env
# Required: your GoClaw gateway WebSocket URL
GOCLAW_URL=wss://your-workspace.goclaw.sh/ws

# Required: gateway auth token (never exposed to browser)
GOCLAW_TOKEN=your-gateway-token-here

# Optional: default agent ID (UUID or slug)
DEFAULT_AGENT_ID=your-agent-id

# Optional: restrict which origins can connect
# ALLOWED_ORIGINS=https://example.com,https://app.example.com

# Optional: require API key for backend-to-proxy auth (server-to-server only, never in browser!)
# PROXY_API_KEY=your-secret-key
```

Install proxy dependencies:

```bash
npm install
```

### Step 3: Start the proxy server

```bash
npm run dev
```

You should see:

```
[proxy] listening on :3100
[proxy] upstream: wss://your-workspace.goclaw.sh/ws
[proxy] auth token: configured
```

### Step 4: Build the widget

In a new terminal, from the project root:

```bash
cd ..
npm run build
```

This outputs `dist/goclaw-webchat.umd.js` and `dist/goclaw-webchat.es.js`.

### Step 5: Add to your website

```html
<script src="path/to/goclaw-webchat.umd.js"></script>
<script>
  GoClaw.init({
    url: 'ws://localhost:3100/ws',  // proxy server URL
    title: 'Chat with us',
    theme: 'auto',
  });
</script>
```

Open the page in a browser — the chat widget appears in the bottom-right corner. No token in client code.

### Step 6: Try the examples

Open any example file in your browser while the proxy is running:

```bash
# Serve the project directory
npx serve .

# Then visit:
# http://localhost:3000/examples/proxy-mode.html      — basic proxy setup
# http://localhost:3000/examples/vanilla-basic.html    — simplest integration
# http://localhost:3000/examples/vanilla-customized.html — custom theme + API
# http://localhost:3000/examples/async-snippet.html    — non-blocking loader
# http://localhost:3000/examples/proxy-with-api-key.html — API key auth
```

## Integration Patterns

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

widget.open();
widget.send('Hello!');
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

### Embed Proxy in Express

If you already run Express/Node.js, embed the proxy directly instead of running a separate process. See `examples/express-embedded-proxy.ts`.

### Docker Compose

For production deployment with nginx reverse proxy, see `examples/docker-compose.yml`.

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | *required* | Proxy server WebSocket URL (`wss://...`) |
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

## Proxy Server Configuration

| Env Variable | Required | Default | Description |
|-------------|----------|---------|-------------|
| `GOCLAW_URL` | Yes | — | GoClaw gateway WebSocket URL |
| `GOCLAW_TOKEN` | Yes | — | Gateway auth token (kept server-side) |
| `PORT` | No | `3100` | Proxy server port |
| `DEFAULT_AGENT_ID` | No | — | Default agent for `chat.send` |
| `ALLOWED_ORIGINS` | No | `*` | Comma-separated allowed origins |
| `MAX_CONNECTIONS_PER_IP` | No | `10` | Per-IP connection limit |
| `TRUST_PROXY` | No | `false` | Trust X-Forwarded-For headers |
| `PROXY_API_KEY` | No | — | Backend-to-proxy auth (server-to-server only) |
| `LOG_LEVEL` | No | `info` | `debug` / `info` / `warn` / `error` |

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
npm install          # Widget deps
npm run dev          # Widget dev server with HMR
npm run build        # Production build
npm run lint         # Type-check

# Proxy server
cd server
npm install
npm run dev          # Start proxy (tsx watch)
npm run build        # Compile to dist/
npm start            # Run compiled proxy
```

## License

MIT
