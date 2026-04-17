import React, { useEffect } from 'react';
import { useGameState } from '../store/useGameState';
import './MessageFeed.css';

/**
 * MessageFeed – displays the latest game messages with fade-out animation.
 * Pulls messages from the global game state store. Only the most recent 5
 * messages are shown. Each message disappears after 8 seconds.
 */
export const MessageFeed: React.FC = () => {
  const messages = useGameState(state => state.messages);
  const removeMessage = useGameState(state => state.removeMessage);

  useEffect(() => {
    const timers = messages.map(msg =>
      setTimeout(() => {
        removeMessage(msg.id);
      }, 8000)
    );
    return () => timers.forEach(clearTimeout);
  }, [messages, removeMessage]);

  return (
    <div className="message-feed">
      {messages.map(msg => (
        <div key={msg.id} className="message-item" title={msg.detail}>
          {msg.title}
        </div>
      ))}
    </div>
  );
};
