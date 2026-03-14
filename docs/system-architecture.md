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

## Data Flow

1. **Init**: `GoClaw.init(config)` → creates ChatWidget → attaches Shadow DOM → connects WebSocket
2. **Auth**: WS open → sends `connect` frame with token → server validates → connected state
3. **Send**: User types → `chat.send` RPC → server runs agent → streams events back
4. **Stream**: `run.started` → `chunk` (tokens) → `tool.call/result` → `run.completed`
5. **Reconnect**: WS close (unclean) → exponential backoff → re-authenticate → resume

## Module Dependencies

```
index.ts
  └── chat-widget.ts
        ├── websocket-client.ts
        │     └── types.ts
        ├── markdown-renderer.ts
        ├── svg-icons.ts
        └── styles/
              ├── theme-variables.ts
              └── widget-styles.ts
```
