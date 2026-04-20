import React from 'react';
import { useGameState } from '../store/useGameState';
import { DollarSign, Calendar, Star, Users, Pause, Play, FastForward, Sun, CloudRain, BarChart2, Beaker, Camera } from 'lucide-react';
import { DataDashboard } from './DataDashboard';
import { ResearchTechTree } from './ResearchTechTree';

export function HUD() {
  const money = useGameState(state => state.money);
  const day = useGameState(state => state.day);
  const month = useGameState(state => state.month);
  const rating = useGameState(state => state.rating);
  const visitorsCount = useGameState(state => state.visitorsCount);
  const speed = useGameState(state => state.speed);
  const gamePaused = useGameState(state => state.gamePaused);
  const weather = useGameState(state => state.weather);
  const setSpeed = useGameState(state => state.setSpeed);
  const togglePause = useGameState(state => state.togglePause);
  const [showData, setShowData] = React.useState(false);
  const [showResearch, setShowResearch] = React.useState(false);

  const takeScreenshot = () => {
     window.dispatchEvent(new CustomEvent('onTakeScreenshot'));
  };

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
        {visitorsCount}/1000
      </div>

      <button onClick={() => setShowData(true)} className="glass-pill" style={{ background: 'var(--primary-color)' }}>
        <BarChart2 size={16} /> 数据
      </button>

      <button onClick={() => setShowResearch(true)} className="glass-pill" style={{ background: '#2E86AB' }}>
        <Beaker size={16} /> 研发
      </button>

      <button onClick={takeScreenshot} className="glass-pill" style={{ background: '#44BBA4' }}>
        <Camera size={16} /> 截图
      </button>

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

      {showData && <DataDashboard onClose={() => setShowData(false)} />}
      {showResearch && <ResearchTechTree onClose={() => setShowResearch(false)} />}
    </div>
  );
}
