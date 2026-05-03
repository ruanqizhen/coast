import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SCENARIOS, SANDBOX_MODE, type ScenarioDef } from '../config/scenarios';
import { Star, Clock, DollarSign, Grid3X3, Compass } from 'lucide-react';

interface Props {
  onSelect: (scenario: ScenarioDef) => void;
}

export function ScenarioSelect({ onSelect }: Props) {
  const [selected, setSelected] = useState<ScenarioDef | null>(null);

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'linear-gradient(180deg, #1a3a4a 0%, #0d1f2d 50%, #1a2f1a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 9998, gap: 32,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Compass size={36} color="#44BBA4" />
        <h1 style={{ fontSize: 36, fontWeight: 700, background: 'linear-gradient(135deg, #44BBA4, #4DB8FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          选择场景
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 16, maxWidth: 900, flexWrap: 'wrap', justifyContent: 'center' }}>
        {SCENARIOS.map(sc => (
          <div key={sc.id} onClick={() => setSelected(sc)} style={{
            width: 260, padding: 24, borderRadius: 14,
            background: selected?.id === sc.id ? 'rgba(68,187,164,0.15)' : 'rgba(255,255,255,0.05)',
            border: selected?.id === sc.id ? '2px solid #44BBA4' : '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer', transition: 'all 0.2s',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}
          onMouseEnter={e => { if (selected?.id !== sc.id) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
          onMouseLeave={e => { if (selected?.id !== sc.id) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            <h3 style={{ fontSize: 18, margin: 0 }}>{sc.name}</h3>
            <p style={{ fontSize: 13, color: '#999', lineHeight: 1.6, margin: 0, minHeight: 50 }}>{sc.description}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#bbb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <DollarSign size={14} color="#F4A223" /> 起始资金: <strong>${sc.startMoney.toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Grid3X3 size={14} color="#4DB8FF" /> 地块: <strong>{sc.startGridSize}×{sc.startGridSize}</strong>
              </div>
              {sc.startLoan > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#E84855' }}>
                  <DollarSign size={14} /> 初始负债: <strong>${sc.startLoan.toLocaleString()}</strong>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star size={14} color="#F4A223" /> 目标: <strong>{'★'.repeat(sc.winStars)} {sc.winVisitors} 游客</strong>
              </div>
              {sc.winDay && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} color="#44BBA4" /> 限时: <strong>{sc.winDay} 天</strong>
                </div>
              )}
              {sc.winMoney && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DollarSign size={14} color="#44BBA4" /> 资金目标: <strong>${sc.winMoney.toLocaleString()}</strong>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Sandbox mode */}
        <div onClick={() => setSelected(SANDBOX_MODE)} style={{
          width: 260, padding: 24, borderRadius: 14,
          background: selected?.id === 'sandbox' ? 'rgba(224,64,251,0.1)' : 'rgba(255,255,255,0.03)',
          border: selected?.id === 'sandbox' ? '2px solid #E040FB' : '1px dashed rgba(255,255,255,0.15)',
          cursor: 'pointer', transition: 'all 0.2s',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <h3 style={{ fontSize: 18, margin: 0, color: '#E040FB' }}>{SANDBOX_MODE.name}</h3>
          <p style={{ fontSize: 13, color: '#999', lineHeight: 1.6, margin: 0 }}>{SANDBOX_MODE.description}</p>
          <div style={{ fontSize: 13, color: '#bbb' }}>
            <DollarSign size={14} color="#F4A223" /> 无限资金 · 无限时间
          </div>
        </div>
      </div>

      <button disabled={!selected} onClick={() => selected && onSelect(selected)} style={{
        padding: '16px 64px', borderRadius: 12, fontSize: 18, fontWeight: 700,
        background: selected ? 'linear-gradient(135deg, #44BBA4, #2E86AB)' : '#333',
        border: 'none', color: selected ? '#111' : '#666', cursor: selected ? 'pointer' : 'not-allowed',
        boxShadow: selected ? '0 8px 32px rgba(68,187,164,0.3)' : 'none',
        transition: 'all 0.3s',
      }}>
        开始游戏
      </button>
    </div>,
    document.body
  );
}
