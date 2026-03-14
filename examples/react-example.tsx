/**
 * React Integration Example
 *
 * Install:
 *   npm install @goclaw/webchat
 *
 * Usage in your React app:
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
        url="wss://goclaw.example.com/ws"
        token="your-gateway-token"
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
