import React from 'react';
import { useParkState } from '../store/useParkState';
import './VisitorInfoCard.css';

/**
 * VisitorInfoCard – displays selected visitor details.
 * Shows position, needs, money and current target.
 */
export const VisitorInfoCard: React.FC = () => {
  const selectedVisitorId = useParkState(state => state.selectedVisitorId);
  const visitors = useParkState(state => state.visitors);

  if (!selectedVisitorId) return null;
  const visitor = visitors[selectedVisitorId];
  if (!visitor) return null;

  return (
    <div className="visitor-info-card">
      <h3>Visitor {visitor.id}</h3>
      <p>Position: ({Math.round(visitor.pos.x)}, {Math.round(visitor.pos.z)})</p>
      <p>Money: ${visitor.money}</p>
      <p>Needs: H {visitor.needs.hunger.toFixed(1)} T {visitor.needs.thirst.toFixed(1)} F {visitor.needs.fatigue.toFixed(1)}</p>
    </div>
  );
};
