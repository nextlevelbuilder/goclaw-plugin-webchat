# Code Standards

## Widget (src/)

### Language & Tooling
- TypeScript strict mode
- ESM modules (Vite library mode)
- No runtime dependencies

## File Naming
- kebab-case for all source files
- Descriptive names (e.g., `websocket-client.ts`, `theme-variables.ts`)

## Code Style
- 2-space indentation
- Single quotes for strings
- Explicit types on public API, inferred internally
- `// ── Section Header ──` for file sections

## Architecture Patterns
- Shadow DOM for UI isolation
- CSS custom properties for theming
- Event-driven WebSocket communication
- Builder pattern for configuration (single config object)
- Proxy-only: widget never handles auth tokens, proxy injects them server-side

### GoClaw Protocol v3 Conventions
- Parameter names use **camelCase**: `agentId`, `sessionKey`, `runId`
- Chat method: `chat.send` with `{ message, agentId, stream }` (not `content`)
- Events wrapped: `{ event: "agent", payload: { type: "chunk", payload: { content } } }`
- Connect method: `connect` with `{ protocol: 3, user_id }` — proxy adds `token`

### Security
- HTML escaping for all user content
- No `eval()` or `innerHTML` with raw user input
- Markdown renderer escapes HTML before processing
- XSS-safe link rendering (only http/https)
- No client-side tokens or API keys — all auth is server-side via proxy

## Proxy Server (server/)

### Language & Tooling
- TypeScript strict mode
- Node.js ESM (type: module in package.json)
- Runtime dependencies: `ws` (WebSocket v8.18+), `dotenv` (env loading)
- Dev dependencies: TypeScript, tsx (dev server), @types/node, @types/ws

### File Naming
- kebab-case for all source files
- Descriptive names (e.g., `websocket-proxy-session.ts`, `connection-tracker.ts`)

### Code Style
- 2-space indentation
- Single quotes for strings
- Explicit types on public API, inferred internally
- Error handling with try-catch blocks

### Architecture Patterns
- Config-driven initialization (environment variables via `proxy-config.ts`)
- `dotenv/config` loaded at entry point for `.env` file support
- Per-IP connection tracking
- Per-session message rate limiting (60 msg/min)
- WebSocket frame interception: injects `GOCLAW_TOKEN` into `connect`, `DEFAULT_AGENT_ID` into `chat.send`
- WebSocket frame buffering until upstream connection ready
- Upstream response sanitization (strips token fields)
- Graceful shutdown with drain timeout
- Non-JSON frames dropped silently

### Security
- Auth token (`GOCLAW_TOKEN`) stored server-side only, never sent to client
- `PROXY_API_KEY` is backend-to-backend only (Express, nginx → proxy), never from browser
- Origin validation via `ALLOWED_ORIGINS` environment variable (empty = allow all)
- Per-IP connection limits via `MAX_CONNECTIONS_PER_IP` (default: 10)
- Per-session rate limiting: 60 messages per minute
- `TRUST_PROXY` flag for reverse proxy (nginx, Cloudflare) deployments
- Max frame size: 512KB
- Upstream gateway URL not included in health endpoint responses
- Connect timeout: 10 seconds for upstream connection
