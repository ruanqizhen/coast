import React, { useState } from 'react';
import { useParkState } from '../store/useParkState';
import { useGameState } from '../store/useGameState';
import { FACILITIES } from '../config/facilities';
import type { FacilityType, Category } from '../types';
import { Tent, DollarSign, X } from 'lucide-react';

const CATEGORIES: { id: Category, label: string }[] = [
  { id: 'thrill', label: '刺激' },
  { id: 'gentle', label: '温和' },
  { id: 'shop', label: '商业' },
  { id: 'facility', label: '基础' }
];

export function BuildBar() {
  const [activeTab, setActiveTab] = useState<Category>('thrill');
  const { enterPlacementMode, placementMode, selectedFacilityToPlace, exitPlacementMode } = useParkState();
  const money = useGameState(state => state.money);

  const displayedFacilities = Object.values(FACILITIES).filter(f => f.category === activeTab);

  if (placementMode) {
    const selectedDef = FACILITIES[selectedFacilityToPlace as FacilityType];
    return (
      <div className="hud-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--success-color)', animation: 'pulse 1s infinite' }} />
          <span>正在建造: <strong>{selectedDef.name}</strong></span>
          <span style={{ color: 'var(--money-color)' }}>-${selectedDef.buildCost.toLocaleString()}</span>
        </div>
        <button 
          onClick={exitPlacementMode}
          style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <X size={16} /> 取消建造 (右键)
        </button>
      </div>
    );
  }

  return (
    <div className="hud-panel" style={{ width: '100%', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px' }}>
        {CATEGORIES.map(cat => (
          <button 
            key={cat.id} 
            onClick={() => setActiveTab(cat.id)}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '6px',
              background: activeTab === cat.id ? 'var(--primary-color)' : 'transparent',
              fontWeight: activeTab === cat.id ? 600 : 400
            }}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Items */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
        {displayedFacilities.map(f => {
          const afford = money >= f.buildCost;
          return (
            <button
              key={f.id}
              onClick={() => afford && enterPlacementMode(f.id)}
              style={{
                width: '120px',
                height: '100px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--panel-border)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: afford ? 1 : 0.4,
                cursor: afford ? 'pointer' : 'not-allowed'
              }}>
              <Tent size={24} color={f.category === 'thrill' ? '#E84855' : f.category === 'shop' ? '#F4A223' : '#2E86AB'} />
              <div style={{ fontSize: '13px', fontWeight: 500 }}>{f.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--money-color)', display: 'flex', alignItems: 'center' }}>
                <DollarSign size={12} />{f.buildCost}
              </div>
            </button>
          )
        })}
      </div>
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
