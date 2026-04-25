import React from 'react';
import { useGameState } from '../store/useGameState';
import {
  DollarSign, Calendar, Star, Users, Pause, Play, FastForward,
  Sun, CloudRain, Cloud, CloudLightning, PartyPopper,
  BarChart2, Beaker, Camera, Save, FolderOpen, Map, Landmark
} from 'lucide-react';
import { saveManager } from '../engine/SaveSystem';
import { useParkState } from '../store/useParkState';
import type { SaveData, WeatherType } from '../types';
import { DataDashboard } from './DataDashboard';
import { ResearchTechTree } from './ResearchTechTree';
import { LoanPanel } from './LoanPanel';
import { ExpansionPanel } from './ExpansionPanel';

const WEATHER_CONFIG: Record<WeatherType, { icon: React.ReactNode; label: string; color: string }> = {
  sunny:      { icon: <Sun size={16} />,            label: '晴天', color: '#F4A223' },
  cloudy:     { icon: <Cloud size={16} />,           label: '多云', color: '#B0BEC5' },
  light_rain: { icon: <CloudRain size={16} />,       label: '小雨', color: '#4DB8FF' },
  heavy_rain: { icon: <CloudLightning size={16} />,  label: '暴雨', color: '#1976D2' },
  holiday:    { icon: <PartyPopper size={16} />,      label: '节假日', color: '#E040FB' },
};

function renderStars(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));
}

export function HUD() {
  const money = useGameState(state => state.money);
  const day = useGameState(state => state.day);
  const month = useGameState(state => state.month);
  const stars = useGameState(state => state.stars);
  const visitorsCount = useGameState(state => state.visitorsCount);
  const speed = useGameState(state => state.speed);
  const gamePaused = useGameState(state => state.gamePaused);
  const weather = useGameState(state => state.weather);
  const nextWeather = useGameState(state => state.nextWeather);
  const setSpeed = useGameState(state => state.setSpeed);
  const togglePause = useGameState(state => state.togglePause);

  const [showData, setShowData] = React.useState(false);
  const [showResearch, setShowResearch] = React.useState(false);
  const [showLoan, setShowLoan] = React.useState(false);
  const [showExpansion, setShowExpansion] = React.useState(false);

  const weatherCfg = WEATHER_CONFIG[weather] || WEATHER_CONFIG.sunny;
  const nextWeatherCfg = WEATHER_CONFIG[nextWeather] || WEATHER_CONFIG.cloudy;

  const takeScreenshot = () => {
     window.dispatchEvent(new CustomEvent('onTakeScreenshot'));
  };

  const handleSave = async () => {
      const gState = useGameState.getState();
      const pState = useParkState.getState();
      
      const data: SaveData = {
          version: "1.0.0",
          park: {
              name: "My Coast Park",
              size: gState.gridSize,
              money: gState.money,
              date: { day: gState.day, month: gState.month },
              rating: gState.rating,
              stars: gState.stars,
              settings: { ticketMode: gState.ticketMode, ticketPrice: gState.ticketPrice, speedMultiplier: gState.speed }
          },
          roads: pState.roads,
          facilities: pState.facilities,
          staff: Object.values(pState.staff).map(s => ({ id: s.id, type: s.type, zone: s.patrolZone })),
          research: { monthlyBudget: gState.monthlyResearchBudget, accumulatedPoints: gState.researchPoints, unlocked: gState.unlockedTechs },
          visitors: Object.values(pState.visitors),
          economy: { loan: gState.loan, historicalData: gState.historicalData },
          weather: gState.weather,
          nextWeather: gState.nextWeather
      };
      
      gState.setSaving(true);
      await saveManager.save('autosave_coast_1', data);
      gState.setSaving(false);
      gState.addMessage({ id: `msg_${Date.now()}`, text: "游戏已保存", priority: 'info', timestamp: Date.now() });
  };

  const handleLoad = async () => {
      const data = await saveManager.load('autosave_coast_1');
      if (data) {
          window.dispatchEvent(new CustomEvent('onGameLoaded', { detail: data }));
          useGameState.getState().addMessage({ id: `msg_${Date.now()}`, text: "游戏已读取", priority: 'info', timestamp: Date.now() });
      } else {
          alert("找不到存档");
      }
  };

  return (
    <div className="hud-panel" style={{ display: 'flex', gap: '12px', padding: '10px 20px', alignItems: 'center', flexWrap: 'wrap' }}>
      
      {/* Money */}
      <div className="glass-pill" style={{ color: 'var(--money-color)' }}>
        <DollarSign size={16} /> 
        {money.toLocaleString()}
      </div>

      {/* Date */}
      <div className="glass-pill">
        <Calendar size={16} /> 
        M{month} D{day}
      </div>

      {/* Weather with forecast tooltip */}
      <div className="glass-pill" style={{ color: weatherCfg.color, position: 'relative', cursor: 'default' }}
           title={`今天: ${weatherCfg.label} | 明天: ${nextWeatherCfg.label}`}>
        {weatherCfg.icon}
        <span style={{ fontSize: 11, marginLeft: 4 }}>{weatherCfg.label}</span>
        <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.6, color: nextWeatherCfg.color }}>
          →{nextWeatherCfg.label}
        </span>
      </div>

      {/* Star Rating */}
      <div className="glass-pill" style={{ color: '#F4A223', letterSpacing: 1 }}>
        <Star size={16} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{renderStars(stars)}</span>
      </div>

      {/* Visitors */}
      <div className="glass-pill">
        <Users size={16} /> 
        {visitorsCount}/1000
      </div>

      {/* Separator */}
      <div style={{ width: '1px', height: '24px', background: 'var(--panel-border)', margin: '0 4px' }} />

      {/* Tool Buttons */}
      <button onClick={() => setShowData(true)} className="glass-pill hud-btn">
        <BarChart2 size={16} /> 数据
      </button>

      <button onClick={() => setShowResearch(true)} className="glass-pill hud-btn" style={{ background: '#2E86AB' }}>
        <Beaker size={16} /> 研发
      </button>

      <button onClick={() => setShowLoan(true)} className="glass-pill hud-btn" style={{ background: '#7B61FF' }}>
        <Landmark size={16} /> 贷款
      </button>

      <button onClick={() => setShowExpansion(true)} className="glass-pill hud-btn" style={{ background: '#44BBA4' }}>
        <Map size={16} /> 扩地
      </button>

      <button onClick={takeScreenshot} className="glass-pill hud-btn" style={{ background: '#00897B' }}>
        <Camera size={16} /> 截图
      </button>

      <button onClick={handleSave} className="glass-pill hud-btn" style={{ background: '#F4A223' }}>
        <Save size={16} /> 保存
      </button>

      <button onClick={handleLoad} className="glass-pill hud-btn" style={{ background: '#F4A223' }}>
        <FolderOpen size={16} /> 读取
      </button>

      {/* Separator */}
      <div style={{ width: '1px', height: '24px', background: 'var(--panel-border)', margin: '0 4px' }} />

      {/* Speed Controls: Pause, ×1, ×2, ×4 */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button onClick={togglePause} className="speed-btn" style={{ background: gamePaused ? 'var(--primary-color)' : 'transparent' }}>
          <Pause size={16} />
        </button>
        <button onClick={() => setSpeed(1)} className="speed-btn" style={{ background: !gamePaused && speed === 1 ? 'var(--primary-color)' : 'transparent' }}>
          <Play size={16} />
        </button>
        <button onClick={() => setSpeed(2)} className="speed-btn" style={{ background: !gamePaused && speed === 2 ? 'var(--primary-color)' : 'transparent' }}>
          <FastForward size={16} />
        </button>
        <button onClick={() => setSpeed(4)} className="speed-btn" style={{ background: !gamePaused && speed === 4 ? 'var(--primary-color)' : 'transparent' }}>
          <FastForward size={16} /><span style={{ fontSize: 10, marginLeft: -4 }}>4</span>
        </button>
      </div>

      {/* Modals */}
      {showData && <DataDashboard onClose={() => setShowData(false)} />}
      {showResearch && <ResearchTechTree onClose={() => setShowResearch(false)} />}
      {showLoan && <LoanPanel onClose={() => setShowLoan(false)} />}
      {showExpansion && <ExpansionPanel onClose={() => setShowExpansion(false)} />}

      <style>{`
        .hud-btn { cursor: pointer; transition: opacity 0.2s; }
        .hud-btn:hover { opacity: 0.85; }
        .speed-btn { padding: 6px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; }
        .speed-btn:hover { opacity: 0.8; }
      `}</style>
    </div>
  );
}
