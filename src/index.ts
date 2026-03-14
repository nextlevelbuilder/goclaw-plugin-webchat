// ── GoClaw WebChat Plugin ──
// Embeddable chat widget for GoClaw AI agent gateway

import type { GoClawConfig, GoClawWidget } from './types';
import { ChatWidget } from './chat-widget';

export type {
  GoClawConfig,
  GoClawWidget,
  ChatMessage,
  ThemeName,
  ThemeOverrides,
  ConnectionState,
  ToolCall,
} from './types';

/** Initialize a GoClaw WebChat widget */
export function init(config: GoClawConfig): GoClawWidget {
  return new ChatWidget(config);
}

// Namespace object for UMD/script-tag usage
const GoClaw = { init };

// Auto-attach to window for script-tag usage
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).GoClaw = GoClaw;

  // Process queued calls from async snippet
  const queue = (window as unknown as Record<string, unknown[]>).__goclaw_queue;
  if (Array.isArray(queue)) {
    for (const args of queue) {
      if (Array.isArray(args) && args[0] === 'init') {
        init(args[1] as GoClawConfig);
      }
    }
    delete (window as unknown as Record<string, unknown>).__goclaw_queue;
  }
}
