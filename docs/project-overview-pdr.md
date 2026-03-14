# Project Overview - GoClaw WebChat Plugin

## Purpose
Embeddable JavaScript chat widget allowing website owners to add AI chat powered by GoClaw agents. Similar to Intercom/Drift but purpose-built for GoClaw's WebSocket RPC protocol v3.

## Tech Stack
- **Language**: TypeScript (strict mode)
- **Build**: Vite 6 (library mode), ESBuild minification
- **Output**: UMD + ESM bundles (~8KB gzipped)
- **UI**: Vanilla DOM + Shadow DOM for style isolation
- **Styling**: CSS custom properties for theming
- **Protocol**: GoClaw WebSocket Protocol v3 (req/res/event frames)

## Architecture
- `src/index.ts` — Entry point, `init()` function, window auto-attach
- `src/websocket-client.ts` — WebSocket connection, auth, RPC, event handling, reconnection
- `src/chat-widget.ts` — Shadow DOM UI, message rendering, input handling
- `src/types.ts` — All TypeScript interfaces
- `src/markdown-renderer.ts` — Lightweight markdown-to-HTML
- `src/svg-icons.ts` — Inline SVG icons
- `src/styles/theme-variables.ts` — Theme system (light/dark/auto/custom)
- `src/styles/widget-styles.ts` — Shadow DOM CSS
- `src/wrappers/react-wrapper.tsx` — React component
- `src/wrappers/vue-wrapper.ts` — Vue 3 plugin

## Distribution
- Script tag (UMD): `<script src="goclaw-webchat.umd.js">`
- NPM package: `import { init } from '@goclaw/webchat'`
- Async snippet: Non-blocking loader with queue (like Intercom)
- Framework wrappers: React component, Vue plugin

## Key Decisions
- Shadow DOM over iframe: Better performance, same-origin access, no CORS issues
- Vanilla TS over framework: Zero deps, universal compatibility
- CSS custom properties: Runtime theming without rebuild
- Exponential backoff reconnect: Resilient WS connections
