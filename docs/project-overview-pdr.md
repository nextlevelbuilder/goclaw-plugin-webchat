# Project Overview - GoClaw WebChat Plugin

## Purpose
Embeddable JavaScript chat widget allowing website owners to add AI chat powered by GoClaw agents. Similar to Intercom/Drift but purpose-built for GoClaw's WebSocket RPC protocol v3.

## Tech Stack
- **Language**: TypeScript (strict mode)
- **Build**: Vite 6 (library mode), ESBuild minification
- **Output**: UMD + ESM bundles (~18KB gzipped)
- **UI**: Vanilla DOM + Shadow DOM for style isolation
- **Styling**: CSS custom properties for theming
- **Protocol**: GoClaw WebSocket Protocol v3 (req/res/event frames)

## Architecture

### Widget (src/)
- `src/index.ts` — Entry point, `init()` function, window auto-attach
- `src/websocket-client.ts` — WebSocket connection, auth, RPC, event handling, reconnection (proxy-only)
- `src/chat-widget.ts` — Shadow DOM UI, message rendering, input handling
- `src/types.ts` — All TypeScript interfaces (proxy-only config, no client-side tokens)
- `src/markdown-renderer.ts` — Lightweight markdown-to-HTML
- `src/svg-icons.ts` — Inline SVG icons
- `src/styles/theme-variables.ts` — Theme system (light/dark/auto/custom)
- `src/styles/widget-styles.ts` — Shadow DOM CSS
- `src/wrappers/react-wrapper.tsx` — React component
- `src/wrappers/vue-wrapper.ts` — Vue 3 plugin

### Proxy Server (server/)
- `server/src/index.ts` — Server entry point, loads dotenv, starts HTTP + WebSocket
- `server/src/proxy-config.ts` — Configuration from environment variables
- `server/src/proxy-server.ts` — HTTP + WebSocket server with origin validation, per-IP limits, API key auth, graceful shutdown
- `server/src/websocket-proxy-session.ts` — Single proxy session: intercepts `connect` frame to inject gateway token, injects `DEFAULT_AGENT_ID` into `chat.send`, buffers upstream messages, rate limits per session
- `server/src/connection-tracker.ts` — Per-IP connection rate limiting

### Examples (examples/)
- `examples/proxy-mode.html` — Basic proxy setup with architecture walkthrough
- `examples/vanilla-basic.html` — Simplest integration
- `examples/vanilla-customized.html` — Custom theme, bottom-left, programmatic API
- `examples/async-snippet.html` — Non-blocking Intercom-style loader
- `examples/proxy-with-api-key.html` — Backend-to-proxy API key auth
- `examples/express-embedded-proxy.ts` — Embed proxy in Express app
- `examples/docker-compose.yml` — Production nginx + proxy deployment
- `examples/examples.css` — Shared CSS for example pages

## Distribution

### Widget
- Script tag (UMD): `<script src="goclaw-webchat.umd.js">`
- NPM package: `import { init } from '@goclaw/webchat'`
- Async snippet: Non-blocking loader with queue (like Intercom)
- Framework wrappers: React component, Vue plugin

### Proxy Server
- Docker-friendly Node.js server (TypeScript)
- Can be self-hosted or deployed to any Node.js-compatible platform
- Dependencies: `ws` (WebSocket library), `dotenv` (env loading)

## Key Decisions
- Shadow DOM over iframe: Better performance, same-origin access, no CORS issues
- Vanilla TS over framework: Zero deps, universal compatibility
- CSS custom properties: Runtime theming without rebuild
- Exponential backoff reconnect: Resilient WS connections
- Proxy-only architecture: All auth tokens stay server-side, no client-side token exposure
- No client-side API key: `PROXY_API_KEY` is backend-to-backend only, never sent from browser
- GoClaw Protocol params: `agentId` (camelCase), `message` (not `content`), nested `event:agent` wrapper
