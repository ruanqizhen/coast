import React, { useState } from 'react';
import { useParkState } from '../store/useParkState';
import { useGameState } from '../store/useGameState';
import { FACILITIES } from '../config/facilities';
import type { FacilityType, Category } from '../types';
import { Tent, DollarSign, X, Lock } from 'lucide-react';

const CATEGORIES: { id: Category | 'staff', label: string }[] = [
  { id: 'thrill', label: '刺激' },
  { id: 'gentle', label: '温和' },
  { id: 'shop', label: '商业' },
  { id: 'facility', label: '基础' },
  { id: 'staff', label: '员工' }
];

const STAFF_DEFS = [
  { id: 'cleaner' as const, name: '清洁工', buildCost: 100, monthlyUpkeep: 60, iconColor: '#44BBA4', requiresStars: 0 },
  { id: 'mechanic' as const, name: '修理工', buildCost: 150, monthlyUpkeep: 90, iconColor: '#2E86AB', requiresStars: 0 },
  { id: 'security' as const, name: '保安', buildCost: 120, monthlyUpkeep: 70, iconColor: '#333333', requiresStars: 0 },
  { id: 'entertainer' as const, name: '演艺人员', buildCost: 80, monthlyUpkeep: 50, iconColor: '#E84855', requiresStars: 0 }
];

export function BuildBar() {
  const [activeTab, setActiveTab] = useState<Category | 'staff'>('thrill');
  const enterPlacementMode = useParkState(state => state.enterPlacementMode);
  const placementMode = useParkState(state => state.placementMode);
  const selectedFacilityToPlace = useParkState(state => state.selectedFacilityToPlace);
  const exitPlacementMode = useParkState(state => state.exitPlacementMode);
  const toggleCoasterBuilder = useParkState(state => state.toggleCoasterBuilder);
  const clearCoasterPieces = useParkState(state => state.clearCoasterPieces);
  
  const money = useGameState(state => state.money);
  const unlockedTechs = useGameState(state => state.unlockedTechs);
  const stars = useGameState(state => state.stars);

  const displayedFacilities = Object.values(FACILITIES).filter(f => f.category === activeTab);

  const handlePlacementSelection = (id: FacilityType | 'cleaner' | 'mechanic') => {
      if (id === 'coaster_basic' || id === 'launch_coaster') {
          clearCoasterPieces();
          enterPlacementMode(id);
          toggleCoasterBuilder(true);
      } else {
          enterPlacementMode(id);
      }
  };

  if (placementMode && selectedFacilityToPlace) {
    let name = '';
    let cost = 0;
    if (selectedFacilityToPlace === 'cleaner') {
       name = '清洁工'; cost = 100;
    } else if (selectedFacilityToPlace === 'mechanic') {
       name = '修理工'; cost = 150;
    } else if (selectedFacilityToPlace === 'security') {
       name = '保安'; cost = 120;
    } else if (selectedFacilityToPlace === 'entertainer') {
       name = '演艺人员'; cost = 80;
    } else {
       const selectedDef = FACILITIES[selectedFacilityToPlace as FacilityType];
       name = selectedDef?.name; cost = selectedDef?.buildCost;
    }

    return (
      <div className="hud-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--success-color)', animation: 'pulse 1s infinite' }} />
          <span>正在选择地点: <strong>{name}</strong></span>
          <span style={{ color: 'var(--money-color)' }}>-${cost.toLocaleString()}</span>
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
        
        {activeTab === 'staff' 
          ? STAFF_DEFS.map(s => {
              const starMet = stars >= (s.requiresStars || 0);
              const afford = money >= s.buildCost;
              const isLocked = !starMet;
              
              return (
                <button
                  key={s.id}
                  onClick={() => !isLocked && afford && handlePlacementSelection(s.id as any)}
                  style={{
                    width: '120px', height: '100px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--panel-border)', borderRadius: '8px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    opacity: isLocked ? 0.3 : (afford ? 1 : 0.6), 
                    cursor: isLocked ? 'not-allowed' : (afford ? 'pointer' : 'not-allowed'),
                    position: 'relative'
                  }}>
                  {isLocked && <div style={{ position: 'absolute', top: 4, right: 4 }}><Lock size={14} color="#aaa" /></div>}
                  <Tent size={24} color={s.iconColor} />
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>{s.name}</div>
                  {isLocked ? (
                    <div style={{ fontSize: '10px', color: '#ff4444' }}>★{s.requiresStars} 解锁</div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--money-color)', display: 'flex', alignItems: 'center' }}>
                      <DollarSign size={12} />{s.buildCost}
                    </div>
                  )}
                </button>
              )
          })
          : displayedFacilities.map(f => {
          const techMet = !f.requiresTech || unlockedTechs.includes(f.requiresTech);
          const starMet = stars >= (f.requiresStars || 0);
          const afford = money >= f.buildCost;
          const isLocked = !techMet || !starMet;

          return (
            <button
              key={f.id}
              onClick={() => !isLocked && afford && handlePlacementSelection(f.id)}
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
                opacity: isLocked ? 0.3 : (afford ? 1 : 0.6),
                cursor: isLocked ? 'not-allowed' : (afford ? 'pointer' : 'not-allowed'),
                position: 'relative'
              }}>
              {isLocked && <div style={{ position: 'absolute', top: 4, right: 4 }}><Lock size={14} color="#aaa" /></div>}
              <Tent size={24} color={f.category === 'thrill' ? '#E84855' : f.category === 'shop' ? '#F4A223' : '#2E86AB'} />
              <div style={{ fontSize: '12px', fontWeight: 500, textAlign: 'center' }}>{f.name}</div>
              {isLocked ? (
                <div style={{ fontSize: '10px', color: '#ff4444', textAlign: 'center' }}>
                  {!techMet ? '技术未解锁' : `★${f.requiresStars} 解锁`}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--money-color)', display: 'flex', alignItems: 'center' }}>
                  <DollarSign size={12} />{f.buildCost}
                </div>
              )}
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
