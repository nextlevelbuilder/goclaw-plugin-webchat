# GoClaw WebChat Plugin

Embeddable JavaScript chat widget for GoClaw AI agent gateway.

## Tech Stack
- TypeScript (strict), Vite 6 (library mode), Shadow DOM
- Output: UMD + ESM (~8KB gzipped)
- No runtime dependencies

## Project Structure
```
src/
├── index.ts                    Entry point, init(), window auto-attach
├── types.ts                    All TypeScript interfaces (GoClawConfig — proxy-only, no direct mode)
├── websocket-client.ts         WS connection, auth, RPC, events, reconnect
├── chat-widget.ts              Shadow DOM UI, message rendering
├── markdown-renderer.ts        Lightweight markdown→HTML
├── svg-icons.ts                Inline SVG icons
├── styles/
│   ├── theme-variables.ts      Light/dark/auto/custom themes
│   └── widget-styles.ts        Shadow DOM CSS
└── wrappers/
    ├── react-wrapper.tsx       React component
    └── vue-wrapper.ts          Vue 3 plugin
server/                         Backend proxy (keeps auth token server-side)
├── src/
│   ├── index.ts                Entry point
│   ├── proxy-config.ts         Config from environment variables
│   ├── proxy-server.ts         HTTP + WebSocket server
│   ├── websocket-proxy-session.ts  Single client↔upstream proxy session
│   └── connection-tracker.ts   Per-IP connection rate limiting
├── .env.example                Example configuration
├── package.json                Server dependencies (ws)
└── tsconfig.json               Server TypeScript config
```

## Commands
```bash
npm install          # Install widget deps
npm run dev          # Widget dev server
npm run build        # tsc --noEmit && vite build
npm run lint         # Type-check only

# Proxy server
cd server && npm install
npm run dev          # Start proxy (tsx watch)
npm run build        # Compile to dist/
npm start            # Run compiled proxy
```

## Key Patterns
- Shadow DOM for style isolation from host page
- CSS custom properties for runtime theming
- GoClaw WebSocket Protocol v3 (req/res/event frames)
- Exponential backoff reconnection
- Async snippet loader pattern (like Intercom)
- Proxy-only: backend injects auth token into WS connect frame, client never sees it (no direct mode)
