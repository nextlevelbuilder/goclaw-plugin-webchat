# Code Standards

## Language & Tooling
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

## Security
- HTML escaping for all user content
- No `eval()` or `innerHTML` with raw user input
- Markdown renderer escapes HTML before processing
- XSS-safe link rendering (only http/https)
