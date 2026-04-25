import { createPortal } from 'react-dom';
import { useGameState } from '../store/useGameState';
import { ExpansionSystem } from '../engine/ExpansionSystem';
import { X, Map, ChevronRight, Lock, CheckCircle } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function ExpansionPanel({ onClose }: Props) {
  const gridSize = useGameState(state => state.gridSize);
  const stars = useGameState(state => state.stars);
  const money = useGameState(state => state.money);
  const setGridSize = useGameState(state => state.setGridSize);
  const deductMoney = useGameState(state => state.deductMoney);
  const addMessage = useGameState(state => state.addMessage);

  const stages = ExpansionSystem.getStages();
  const { canExpand, reason } = ExpansionSystem.canExpand(gridSize, stars, money);
  const nextSize = ExpansionSystem.getNextSize(gridSize);
  const cost = ExpansionSystem.getCost();

  const handleExpand = () => {
    if (!canExpand) return;
    if (deductMoney(cost)) {
      setGridSize(nextSize);
      addMessage({
        id: `msg_${Date.now()}`,
        text: `🗺️ 地块已扩张至 ${nextSize}×${nextSize}！`,
        priority: 'milestone',
        timestamp: Date.now(),
      });
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="hud-panel" style={{ width: 440, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Map size={20} color="#44BBA4" /> 地块扩张
          </h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {/* Current size */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 16,
          border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center'
        }}>
          <div style={{ color: '#999', fontSize: 13, marginBottom: 4 }}>当前地块大小</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#44BBA4' }}>{gridSize} × {gridSize}</div>
          <div style={{ color: '#666', fontSize: 12 }}>= {gridSize * 2}m × {gridSize * 2}m</div>
        </div>

        {/* Stages */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stages.map(stage => {
            const isCompleted = gridSize >= stage.size;
            const isCurrent = !isCompleted && gridSize + 16 >= stage.size;
            const starsOk = stars >= stage.starsRequired;
            const _moneyOk = money >= stage.cost;
            void _moneyOk; // used only for display styling below

            return (
              <div key={stage.size} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 8,
                background: isCompleted ? 'rgba(68, 187, 164, 0.08)' : isCurrent ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isCompleted ? 'rgba(68, 187, 164, 0.3)' : 'rgba(255,255,255,0.06)'}`,
                opacity: isCompleted ? 0.7 : 1,
              }}>
                {isCompleted ? (
                  <CheckCircle size={20} color="#44BBA4" />
                ) : starsOk ? (
                  <ChevronRight size={20} color="#F4A223" />
                ) : (
                  <Lock size={20} color="#666" />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{stage.size} × {stage.size}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {stage.starsRequired > 0 ? `需要 ${'★'.repeat(stage.starsRequired)} 评级 · ` : ''}
                    费用 ${stage.cost.toLocaleString()}
                  </div>
                </div>
                {isCompleted && <span style={{ fontSize: 12, color: '#44BBA4' }}>已完成</span>}
              </div>
            );
          })}
        </div>

        {/* Action */}
        {gridSize < 128 && (
          <button
            disabled={!canExpand}
            onClick={handleExpand}
            style={{
              padding: '12px 0', borderRadius: 8, fontSize: 15, fontWeight: 600,
              background: canExpand ? '#44BBA4' : '#333',
              color: '#fff',
              cursor: canExpand ? 'pointer' : 'not-allowed',
              width: '100%'
            }}
          >
            {canExpand
              ? `扩张至 ${nextSize}×${nextSize} — $${cost.toLocaleString()}`
              : reason}
          </button>
        )}
        {gridSize >= 128 && (
          <div style={{ textAlign: 'center', color: '#44BBA4', fontSize: 14 }}>
            ✓ 已达到最大地块尺寸
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
