import { useState } from 'react';
import { useParkState } from '../store/useParkState';
import { useGameState } from '../store/useGameState';
import { FACILITIES } from '../config/facilities';
import type { FacilityType, Category } from '../types';
import {
  DollarSign, X, Lock,
  Zap, Ship, ArrowDownFromLine, Rocket,
  Disc3, Car, Ghost,
  Beef, CupSoda, UtensilsCrossed,
  Bath, Armchair, Trash2, HeartPulse,
  Flower2, Droplets, Umbrella,
  Brush, Wrench, Shield, Drama,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Per-facility icon + color mapping
const FACILITY_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  // Thrill
  coaster_basic:  { icon: Zap, color: '#E84855' },
  pirate_ship:    { icon: Ship, color: '#F4A223' },
  drop_tower:     { icon: ArrowDownFromLine, color: '#FF6B6B' },
  launch_coaster: { icon: Rocket, color: '#E040FB' },
  // Gentle
  merry_go_round: { icon: Disc3, color: '#F4A223' },
  ferris_wheel:   { icon: Disc3, color: '#4DB8FF' },
  bumper_cars:    { icon: Car, color: '#44BBA4' },
  dark_ride:      { icon: Ghost, color: '#7B61FF' },
  // Shop
  burger_stall:   { icon: Beef, color: '#E84855' },
  drink_stall:    { icon: CupSoda, color: '#4DB8FF' },
  restaurant:     { icon: UtensilsCrossed, color: '#F4A223' },
  // Facility
  restroom:       { icon: Bath, color: '#2E86AB' },
  bench:          { icon: Armchair, color: '#8D6E63' },
  trash_can:      { icon: Trash2, color: '#78909C' },
  first_aid:      { icon: HeartPulse, color: '#E84855' },
  // Scenery
  flower_bed:     { icon: Flower2, color: '#E040FB' },
  fountain:       { icon: Droplets, color: '#4DB8FF' },
  weather_tent:   { icon: Umbrella, color: '#44BBA4' },
};

const STAFF_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  cleaner:     { icon: Brush, color: '#44BBA4' },
  mechanic:    { icon: Wrench, color: '#2E86AB' },
  security:    { icon: Shield, color: '#78909C' },
  entertainer: { icon: Drama, color: '#E040FB' },
};

const CATEGORIES: { id: Category | 'staff' | 'road'; label: string; emoji: string }[] = [
  { id: 'thrill', label: '刺激', emoji: '🎢' },
  { id: 'gentle', label: '温和', emoji: '🎠' },
  { id: 'shop', label: '商业', emoji: '🍟' },
  { id: 'facility', label: '基础', emoji: '🏛' },
  { id: 'scenery', label: '景观', emoji: '🌿' },
  { id: 'staff', label: '员工', emoji: '👷' },
  { id: 'road', label: '道路', emoji: '🛤' },
];

const STAFF_DEFS = [
  { id: 'cleaner' as const, name: '清洁工', buildCost: 100, requiresStars: 0 },
  { id: 'mechanic' as const, name: '修理工', buildCost: 150, requiresStars: 0 },
  { id: 'security' as const, name: '保安', buildCost: 120, requiresStars: 0 },
  { id: 'entertainer' as const, name: '演艺人员', buildCost: 80, requiresStars: 0 },
];

const CAT_BG: Record<string, string> = {
  thrill: 'rgba(232,72,85,0.12)',
  gentle: 'rgba(77,184,255,0.12)',
  shop: 'rgba(244,162,35,0.12)',
  facility: 'rgba(46,134,171,0.12)',
  scenery: 'rgba(68,187,164,0.12)',
};

export function BuildBar() {
  const [activeTab, setActiveTab] = useState<Category | 'staff' | 'road'>('thrill');
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

  const handleSelect = (id: FacilityType | 'cleaner' | 'mechanic' | 'security' | 'entertainer', category: 'facility' | 'staff') => {
    if (id === 'coaster_basic' || id === 'launch_coaster') {
      clearCoasterPieces();
      enterPlacementMode(id, category);
      toggleCoasterBuilder(true);
    } else {
      enterPlacementMode(id, category);
    }
  };

  // Placement mode banner
  if (placementMode && selectedFacilityToPlace) {
    let name = '';
    let cost: number | string = 0;
    if (selectedFacilityToPlace === 'cleaner') { name = '清洁工'; cost = 100; }
    else if (selectedFacilityToPlace === 'mechanic') { name = '修理工'; cost = 150; }
    else if (selectedFacilityToPlace === 'security') { name = '保安'; cost = 120; }
    else if (selectedFacilityToPlace === 'entertainer') { name = '演艺人员'; cost = 80; }
    else if (selectedFacilityToPlace === 'normal') { name = '普通道路'; cost = '5/格'; }
    else if (selectedFacilityToPlace === 'wide') { name = '宽路'; cost = '9/格'; }
    else if ((selectedFacilityToPlace as string) === 'staff') { name = '员工道路'; cost = '3/格'; }
    else {
      const d = FACILITIES[selectedFacilityToPlace as FacilityType];
      name = d?.name ?? String(selectedFacilityToPlace);
      cost = d?.buildCost ?? 0;
    }

    return (
      <div className="hud-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--success-color)', animation: 'pulse 1s infinite' }} />
          <span>正在选择地点: <strong>{name}</strong></span>
          <span style={{ color: 'var(--money-color)' }}>-${typeof cost === 'number' ? cost.toLocaleString() : cost}</span>
        </div>
        <button onClick={exitPlacementMode} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <X size={16} /> 取消建造 (右键)
        </button>
      </div>
    );
  }

  return (
    <div className="hud-panel" style={{ width: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--panel-border)', paddingBottom: 12 }}>
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setActiveTab(cat.id)} style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 13,
            background: activeTab === cat.id ? 'var(--primary-color)' : 'transparent',
            fontWeight: activeTab === cat.id ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 14 }}>{cat.emoji}</span> {cat.label}
          </button>
        ))}
      </div>

      {/* Items */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
        {activeTab === 'staff'
          ? STAFF_DEFS.map(s => {
              const starMet = stars >= (s.requiresStars || 0);
              const afford = money >= s.buildCost;
              const isLocked = !starMet;
              const si = STAFF_ICONS[s.id] || { icon: Brush, color: '#888' };
              const Icon = si.icon;
              return (
                <button key={s.id} onClick={() => !isLocked && afford && handleSelect(s.id as any, 'staff')} className="build-card" style={{
                  opacity: isLocked ? 0.3 : afford ? 1 : 0.6,
                  cursor: isLocked || !afford ? 'not-allowed' : 'pointer',
                  '--card-accent': si.color,
                } as React.CSSProperties}>
                  {isLocked && <div className="build-card-lock"><Lock size={12} color="#aaa" /></div>}
                  <div className="build-card-icon" style={{ background: `${si.color}20`, color: si.color }}>
                    <Icon size={22} />
                  </div>
                  <div className="build-card-name">{s.name}</div>
                  {isLocked
                    ? <div className="build-card-locked-text">★{s.requiresStars} 解锁</div>
                    : <div className="build-card-price"><DollarSign size={11} />{s.buildCost}</div>
                  }
                </button>
              );
            })
          : activeTab === 'road'
          ? (['normal', 'wide', 'staff'] as const).map(type => (
              <button key={type} onClick={() => enterPlacementMode(type as any, 'road')} className="build-card" style={{ cursor: 'pointer' }}>
                <div className="build-card-icon" style={{ background: 'rgba(136,136,136,0.15)', color: '#aaa' }}>
                  <div style={{ width: 32, height: type === 'wide' ? 10 : 6, background: type === 'staff' ? '#997755' : '#999', borderRadius: 3 }} />
                </div>
                <div className="build-card-name">{type === 'normal' ? '普通道路' : type === 'wide' ? '宽路' : '员工道路'}</div>
                <div className="build-card-price"><DollarSign size={11} />{type === 'normal' ? 5 : type === 'wide' ? 9 : 3}/格</div>
              </button>
            ))
          : displayedFacilities.map(f => {
              const techMet = !f.requiresTech || unlockedTechs.includes(f.requiresTech);
              const starMet = stars >= (f.requiresStars || 0);
              const afford = money >= f.buildCost;
              const isLocked = !techMet || !starMet;
              const fi = FACILITY_ICONS[f.id] || { icon: Zap, color: '#888' };
              const Icon = fi.icon;
              const bg = CAT_BG[f.category] || 'rgba(255,255,255,0.05)';
              return (
                <button key={f.id} onClick={() => !isLocked && afford && handleSelect(f.id, 'facility')} className="build-card" style={{
                  opacity: isLocked ? 0.3 : afford ? 1 : 0.6,
                  cursor: isLocked || !afford ? 'not-allowed' : 'pointer',
                  background: bg,
                }}>
                  {isLocked && <div className="build-card-lock"><Lock size={12} color="#aaa" /></div>}
                  <div className="build-card-icon" style={{ background: `${fi.color}20`, color: fi.color }}>
                    <Icon size={22} />
                  </div>
                  <div className="build-card-name">{f.name}</div>
                  {isLocked
                    ? <div className="build-card-locked-text">{!techMet ? '技术未解锁' : `★${f.requiresStars} 解锁`}</div>
                    : <div className="build-card-price"><DollarSign size={11} />{f.buildCost}</div>
                  }
                </button>
              );
            })
        }
      </div>

      <style>{`
        .build-card {
          min-width: 110px; width: 110px; padding: 10px 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          position: relative;
          transition: transform 0.15s, border-color 0.15s;
        }
        .build-card:hover:not([disabled]) {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.2);
        }
        .build-card-lock { position: absolute; top: 6px; right: 6px; }
        .build-card-icon {
          width: 42px; height: 42px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .build-card-name { font-size: 12px; font-weight: 500; text-align: center; line-height: 1.3; }
        .build-card-price { font-size: 12px; color: var(--money-color); display: flex; align-items: center; font-weight: 600; }
        .build-card-locked-text { font-size: 10px; color: #ff4444; text-align: center; }
        @keyframes pulse { 0%{opacity:1} 50%{opacity:0.5} 100%{opacity:1} }
      `}</style>
    </div>
  );
}
