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
├── types.ts                    All TypeScript interfaces
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
```

## Commands
```bash
npm install          # Install deps
npm run dev          # Dev server
npm run build        # tsc --noEmit && vite build
npm run lint         # Type-check only
```

## Key Patterns
- Shadow DOM for style isolation from host page
- CSS custom properties for runtime theming
- GoClaw WebSocket Protocol v3 (req/res/event frames)
- Exponential backoff reconnection
- Async snippet loader pattern (like Intercom)
