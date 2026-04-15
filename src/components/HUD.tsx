import React from 'react';
import { useGameState } from '../store/useGameState';
import { DollarSign, Calendar, Star, Users, Pause, Play, FastForward, Sun, CloudRain } from 'lucide-react';

export function HUD() {
  const { money, day, month, rating, visitors, speed, gamePaused, weather, setSpeed, togglePause } = useGameState();

  return (
    <div className="hud-panel" style={{ display: 'flex', gap: '16px', padding: '12px 24px', alignItems: 'center' }}>
      
      <div className="glass-pill" style={{ color: 'var(--money-color)' }}>
        <DollarSign size={16} /> 
        {money.toLocaleString()}
      </div>

      <div className="glass-pill">
        <Calendar size={16} /> 
        M{month} D{day}
      </div>

      <div className="glass-pill" style={{ color: weather === 'sunny' ? '#F4A223' : '#4DB8FF' }}>
        {weather === 'sunny' ? <Sun size={16} /> : <CloudRain size={16} />}
      </div>

      <div className="glass-pill" style={{ color: 'var(--success-color)' }}>
        <Star size={16} /> 
        {rating.toFixed(1)}
      </div>

      <div className="glass-pill">
        <Users size={16} /> 
        {visitors}/1000
      </div>

      <div style={{ width: '1px', height: '24px', background: 'var(--panel-border)', margin: '0 8px' }} />

      <div style={{ display: 'flex', gap: '4px' }}>
        <button onClick={togglePause} style={{ padding: '6px', borderRadius: '4px', background: gamePaused ? 'var(--primary-color)' : 'transparent' }}>
          <Pause size={16} />
        </button>
        <button onClick={() => setSpeed(1)} style={{ padding: '6px', borderRadius: '4px', background: !gamePaused && speed === 1 ? 'var(--primary-color)' : 'transparent' }}>
          <Play size={16} />
        </button>
        <button onClick={() => setSpeed(2)} style={{ padding: '6px', borderRadius: '4px', background: speed === 2 ? 'var(--primary-color)' : 'transparent' }}>
          <FastForward size={16} />
        </button>
      </div>

    </div>
  );
}
