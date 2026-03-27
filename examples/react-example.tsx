/**
 * React Integration Example (Proxy Mode)
 *
 * Prerequisites:
 *   1. Start the proxy server: cd server && npm run dev
 *   2. npm install @goclaw/webchat
 *
 * The proxy server keeps the auth token server-side.
 * The widget only needs the proxy URL — no token required.
 */

import { useRef } from 'react';
import { GoClawChat } from '@goclaw/webchat/react';
import type { GoClawWidget } from '@goclaw/webchat';

export default function App() {
  const widgetRef = useRef<GoClawWidget | null>(null);

  return (
    <div>
      <h1>My App with GoClaw Chat</h1>

      <button onClick={() => widgetRef.current?.open()}>
        Open Support Chat
      </button>

      <GoClawChat
        widgetRef={widgetRef}
        url="wss://proxy.example.com/ws"
        title="AI Support"
        subtitle="Typically replies instantly"
        welcomeMessage="Hi there! How can we help you today?"
        theme="auto"
        agentId="support-agent"
        onMessage={(msg) => {
          console.log('New message:', msg.content);
        }}
      />
    </div>
  );
}
