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
              │ WebSocket (no token)
              ▼
┌─────────────────────────────────────────┐
│        WebChat Proxy Server             │
│  ┌──────────┐  ┌───────────────────┐    │
│  │ WS Server │  │ Token Injection  │    │
│  │ /ws :3100 │──│ (connect frame)  │    │
│  └──────────┘  └───────────────────┘    │
│  Origin validation │ Per-IP limits      │
│  API key auth (opt) │ agentId inject    │
└─────────────────────────────────────────┘
              │ WebSocket (with GOCLAW_TOKEN)
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
│  │ API Keys│   │ (13+ LLMs) │           │
│  └─────────┘   └────────────┘           │
└─────────────────────────────────────────┘
```

## Data Flow

1. **Init**: `GoClaw.init({ url })` → creates ChatWidget → attaches Shadow DOM → connects WebSocket to proxy
2. **Auth**: WS open → sends `connect` frame (no token) → proxy intercepts and injects `GOCLAW_TOKEN` → forwards to gateway → connected
3. **Send**: User types → `chat.send` RPC with `{ message, agentId, stream }` → proxy injects `DEFAULT_AGENT_ID` if not set → forwards to gateway
4. **Stream**: `event:agent { type: "run.started" }` → `{ type: "chunk", payload: { content } }` → `{ type: "run.completed" }`
5. **Reconnect**: WS close (unclean) → exponential backoff → re-authenticate → resume

## GoClaw WebSocket Protocol v3

### Request Frame
```json
{ "type": "req", "id": "req_1", "method": "chat.send", "params": { "message": "hello", "agentId": "uuid-or-slug", "stream": true } }
```

### Response Frame
```json
{ "type": "res", "id": "req_1", "ok": true, "payload": { "runId": "...", "content": "..." } }
```

### Event Frame (agent events are nested)
```json
{ "type": "event", "event": "agent", "payload": { "type": "chunk", "agentId": "kha-dao", "runId": "...", "payload": { "content": "token text" } } }
```

### Agent Event Types
| Event | Description |
|-------|-------------|
| `run.started` | Agent started processing |
| `activity` | Agent phase change (thinking, acting) |
| `thinking` | Thinking tokens (internal reasoning) |
| `chunk` | Response content tokens |
| `tool.call` | Tool invocation started |
| `tool.result` | Tool execution completed |
| `run.completed` | Agent finished, includes final content + usage |
| `run.failed` | Agent failed with error |

## Module Dependencies

### Widget
```
index.ts
  └── chat-widget.ts
        ├── websocket-client.ts (connects to proxy url)
        │     └── types.ts
        ├── markdown-renderer.ts
        ├── svg-icons.ts
        └── styles/
              ├── theme-variables.ts
              └── widget-styles.ts
```

### Proxy Server
```
index.ts (loads dotenv)
  ├── proxy-config.ts (reads env vars)
  ├── proxy-server.ts (HTTP + WebSocket server)
  │   ├── websocket-proxy-session.ts (per-connection handler)
  │   └── connection-tracker.ts (per-IP rate limiting)
  └── ws (external: WebSocket library)
```

## Security Model

### Proxy-Only Architecture (Production)
```
Browser (no token) → Proxy Server (holds token) → GoClaw Gateway
- Widget config: { url: 'wss://proxy/ws' }
- Proxy env: GOCLAW_TOKEN, DEFAULT_AGENT_ID
- Token never exposed to client
```

### Dual Auth Layers
| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| **Client → Proxy** | `PROXY_API_KEY` (optional) | Control who can use the proxy |
| **Proxy → Gateway** | `GOCLAW_TOKEN` (required) | Authenticate proxy to GoClaw |

### Proxy Security Features
- **Token injection**: Intercepts WS `connect` frame, injects gateway token server-side
- **agentId injection**: Injects `DEFAULT_AGENT_ID` into `chat.send` if client omits it
- **Token stripping**: Removes token fields from upstream responses (defense in depth)
- **API key auth**: Optional `PROXY_API_KEY` — clients authenticate via `?apiKey=xxx` or `X-API-Key` header
- **Origin validation**: Rejects connections from unauthorized origins (`ALLOWED_ORIGINS`)
- **Rate limiting**: Max connections per IP (`MAX_CONNECTIONS_PER_IP`, default 10)
- **Rate limiting (per-session)**: 60 messages/minute per WebSocket session
- **Reverse proxy support**: `TRUST_PROXY` for X-Forwarded-For behind nginx/Cloudflare
- **Frame size limit**: 512KB max WebSocket frame
- **Non-JSON filtering**: Non-JSON frames silently dropped

## Examples

| Example | File | Description |
|---------|------|-------------|
| Proxy mode | `examples/proxy-mode.html` | Basic proxy setup, architecture walkthrough |
| Basic | `examples/vanilla-basic.html` | Simplest integration |
| Customized | `examples/vanilla-customized.html` | Custom theme, bottom-left, programmatic API |
| Async snippet | `examples/async-snippet.html` | Non-blocking Intercom-style loader |
| API key auth | `examples/proxy-with-api-key.html` | Proxy with `PROXY_API_KEY` |
| Express embedded | `examples/express-embedded-proxy.ts` | Embed proxy in Express app |
| Docker compose | `examples/docker-compose.yml` | Production nginx + proxy setup |
