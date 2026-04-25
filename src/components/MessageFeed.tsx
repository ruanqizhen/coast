import React, { useEffect } from 'react';
import { useGameState } from '../store/useGameState';
import type { GameMessage } from '../types';
import './MessageFeed.css';

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#E84855',
  warning: '#F4A223',
  milestone: '#44BBA4',
  info: '#4DB8FF',
};

/**
 * MessageFeed – PRD §6.2 compliant message system.
 * Shows max 3 messages, fades after 5 seconds.
 * Click on messages with targetPos to pan camera.
 */
export const MessageFeed: React.FC = () => {
  const messages = useGameState(state => state.messages);
  const removeMessage = useGameState(state => state.removeMessage);

  // Auto-remove after 5 seconds (PRD §6.2)
  useEffect(() => {
    const timers = messages.slice(0, 3).map(msg =>
      setTimeout(() => {
        removeMessage(msg.id);
      }, 5000)
    );
    return () => timers.forEach(clearTimeout);
  }, [messages, removeMessage]);

  const handleClick = (msg: GameMessage) => {
    if (msg.targetPos) {
      window.dispatchEvent(new CustomEvent('onMessageClick', { detail: { targetPos: msg.targetPos, targetId: msg.targetId } }));
    }
  };

  // Only show top 3 (PRD §6.2)
  const visibleMessages = messages.slice(0, 3);

  return (
    <div className="message-feed">
      {visibleMessages.map(msg => (
        <div
          key={msg.id}
          className={`message-item ${msg.targetPos ? 'clickable' : ''}`}
          onClick={() => handleClick(msg)}
        >
          <div
            className="message-priority-dot"
            style={{ background: PRIORITY_COLORS[msg.priority] || '#4DB8FF' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.4 }}>
              {msg.text}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
