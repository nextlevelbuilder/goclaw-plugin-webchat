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

### Security
- HTML escaping for all user content
- No `eval()` or `innerHTML` with raw user input
- Markdown renderer escapes HTML before processing
- XSS-safe link rendering (only http/https)

## Proxy Server (server/)

### Language & Tooling
- TypeScript strict mode
- Node.js ESM (type: module in package.json)
- Runtime dependency: `ws` (WebSocket library v8.18+)
- Dev dependencies: TypeScript, tsx (development server), @types/node, @types/ws

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
- Per-IP connection tracking with exponential backoff
- WebSocket frame buffering until upstream connection ready
- Graceful shutdown with drain timeout
- Non-JSON frames dropped silently

### Security
- Auth token stored server-side only, never sent to client
- Origin validation via `ALLOWED_ORIGINS` environment variable (empty = allow all)
- Per-IP connection limits via `MAX_CONNECTIONS_PER_IP` (default: 10)
- TRUST_PROXY flag for reverse proxy (nginx, Cloudflare) deployments
- Max frame size: 512KB
- Upstream gateway URL not included in health endpoint responses
