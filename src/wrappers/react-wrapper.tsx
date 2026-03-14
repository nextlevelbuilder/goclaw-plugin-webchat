// ── React wrapper for GoClaw WebChat ──

import { useEffect, useRef } from 'react';
import type { GoClawConfig, GoClawWidget } from '../types';
import { ChatWidget } from '../chat-widget';

export interface GoClawChatProps extends GoClawConfig {
  /** React ref to access the widget API */
  widgetRef?: React.MutableRefObject<GoClawWidget | null>;
}

/**
 * React component for GoClaw WebChat.
 *
 * Usage:
 * ```tsx
 * import { GoClawChat } from '@goclaw/webchat/react';
 *
 * function App() {
 *   return (
 *     <GoClawChat
 *       url="wss://goclaw.example.com/ws"
 *       token="your-token"
 *       title="Support"
 *       theme="auto"
 *     />
 *   );
 * }
 * ```
 */
export function GoClawChat({ widgetRef, ...config }: GoClawChatProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetInstance = useRef<GoClawWidget | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const widget = new ChatWidget({
      ...config,
      container: containerRef.current,
    });

    widgetInstance.current = widget;
    if (widgetRef) widgetRef.current = widget;

    return () => {
      widget.destroy();
      widgetInstance.current = null;
      if (widgetRef) widgetRef.current = null;
    };
    // Only re-create on url/token change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.url, config.token]);

  return <div ref={containerRef} />;
}
