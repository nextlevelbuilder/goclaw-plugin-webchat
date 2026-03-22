# System Architecture

## Component Diagram

```
┌─────────────────────────────────────────┐
│              Host Website               │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  <div id="goclaw-webchat">       │  │
│  │    ┌─ Shadow DOM ──────────────┐  │  │
│  │    │  <style> (isolated CSS)   │  │  │
│  │    │  Launcher Button          │  │  │
│  │    │  Chat Window              │  │  │
│  │    │  ├── Header               │  │  │
│  │    │  ├── Status Bar           │  │  │
│  │    │  ├── Messages List        │  │  │
│  │    │  ├── Typing Indicator     │  │  │
│  │    │  └── Input Area           │  │  │
│  │    └───────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
              │ WebSocket
              ▼
┌─────────────────────────────────────────┐  (optional)
│        WebChat Proxy Server             │
│  ┌──────────┐  ┌───────────────────┐    │
│  │ WS Server │  │ Token Injection  │    │
│  │ /ws :3100 │──│ (connect frame)  │    │
│  └──────────┘  └───────────────────┘    │
│  Origin validation │ Per-IP limits      │
└─────────────────────────────────────────┘
              │ WebSocket (with token)
              ▼
┌─────────────────────────────────────────┐
│           GoClaw Gateway                │
│  ┌──────────┐  ┌───────────────────┐    │
│  │ WS Server │  │ Agent Engine     │    │
│  │ /ws       │──│ Think→Act→Observe│    │
│  └──────────┘  └───────────────────┘    │
│       │              │                   │
│  ┌────┴────┐   ┌─────┴──────┐           │
│  │ Auth    │   │ LLM Provider│           │
│  │ Pairing │   │ (13+ LLMs) │           │
│  └─────────┘   └────────────┘           │
└─────────────────────────────────────────┘
```

### Connection Modes

1. **Direct mode** (`url` + `token`): Widget connects directly to GoClaw Gateway. Token exposed in client-side JS. Suitable for development or trusted environments.
2. **Proxy mode** (`proxyUrl`): Widget connects to proxy server, which holds the token server-side and injects it into the WS `connect` frame. Recommended for production.

## Data Flow

1. **Init**: `GoClaw.init(config)` → creates ChatWidget → attaches Shadow DOM → connects WebSocket (to `proxyUrl` if set, else `url`)
2. **Auth**: WS open → sends `connect` frame (token injected by proxy in proxy mode, or sent directly) → server validates → connected state
3. **Send**: User types → `chat.send` RPC → server runs agent → streams events back
4. **Stream**: `run.started` → `chunk` (tokens) → `tool.call/result` → `run.completed`
5. **Reconnect**: WS close (unclean) → exponential backoff → re-authenticate → resume

## Module Dependencies

### Widget
```
index.ts
  └── chat-widget.ts
        ├── websocket-client.ts (uses proxyUrl or direct url+token)
        │     └── types.ts
        ├── markdown-renderer.ts
        ├── svg-icons.ts
        └── styles/
              ├── theme-variables.ts
              └── widget-styles.ts
```

### Proxy Server
```
index.ts
  ├── proxy-config.ts (reads env vars)
  ├── proxy-server.ts (HTTP + WebSocket server)
  │   ├── websocket-proxy-session.ts (per-connection handler)
  │   └── connection-tracker.ts (per-IP rate limiting)
  └── ws (external: WebSocket library)
```

## Security Model

### Direct Mode (Development)
```
Browser (holds token) → GoClaw Gateway
- Widget config: { url, token }
- Risk: Token visible in client-side JS
- Use case: Local dev, trusted environments only
```

### Proxy Mode (Production - Recommended)
```
Browser (no token) → Proxy Server (holds token) → GoClaw Gateway
- Widget config: { proxyUrl }
- Proxy config: GOCLAW_TOKEN env var
- Benefits: Token never exposed to client, origin validation, rate limiting
- Deployment: Self-host or use managed proxy service
```

## Proxy Security Features
- **Token injection**: Proxy intercepts WS `connect` frame and injects gateway token server-side
- **Origin validation**: Rejects connections from unauthorized origins (ALLOWED_ORIGINS env)
- **Rate limiting**: Max connections per IP (MAX_CONNECTIONS_PER_IP env, default 10)
- **Reverse proxy support**: TRUST_PROXY flag for X-Forwarded-For header when behind nginx/Cloudflare
- **Frame size limit**: 512KB max WebSocket frame
- **Silent filtering**: Non-JSON frames dropped without error
- **Secure defaults**: Health endpoint excludes upstream URL
