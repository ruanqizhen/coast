import React from 'react';
import { useParkState } from '../store/useParkState';
// useGameState available if needed for economy interactions
import { FACILITIES, DEFAULT_TICKET_PRICES } from '../config/facilities';
import { X, Wrench, Trash2, AlertTriangle } from 'lucide-react';
import './FacilityInfoCard.css';

/**
 * FacilityInfoCard – PRD §6.3 compliant facility detail card.
 * Shows queue, riders, income, breakdown, pricing, repair, demolish actions.
 */
export const FacilityInfoCard: React.FC = () => {
  const selectedFacilityId = useParkState(state => state.selectedFacilityId);
  const facilities = useParkState(state => state.facilities);
  const visitors = useParkState(state => state.visitors);
  const selectFacility = useParkState(state => state.selectFacility);
  const updateFacility = useParkState(state => state.updateFacility);
  const removeFacility = useParkState(state => state.removeFacility);

  if (!selectedFacilityId) return null;
  const facility = facilities.find(f => f.instanceId === selectedFacilityId);
  if (!facility) return null;

  const def = FACILITIES[facility.typeId];
  if (!def) return null;

  // Count visitors queuing/riding at this facility
  const queueCount = Object.values(visitors).filter(
    v => v.targetFacilityId === facility.instanceId && (v.state === 'queuing' || v.state === 'walking')
  ).length;
  const ridingCount = Object.values(visitors).filter(
    v => v.targetFacilityId === facility.instanceId && v.state === 'riding'
  ).length;

  const estimatedWaitMin = Math.ceil(queueCount * ((def.rideDuration || 15000) / 60000));
  const defaultPrice = DEFAULT_TICKET_PRICES[facility.typeId] || 5;
  const currentPrice = facility.ticketPrice || defaultPrice;

  // Breakdown rate estimation (from PRD formula)
  const breakdownRate = Math.min(99, (facility.age * 0.001 + facility.totalRides * 0.0005) * 100);

  const handlePriceChange = (newPrice: number) => {
    updateFacility(facility.instanceId, { ticketPrice: newPrice });
  };

  const handleDemolish = () => {
    // Dispatch to worker for refund calculation
    window.dispatchEvent(new CustomEvent('onFacilityDemolish', { detail: { id: facility.instanceId } }));
    removeFacility(facility.instanceId);
    selectFacility(null);
  };

  const handleRepair = () => {
    updateFacility(facility.instanceId, { breakdown: false });
    window.dispatchEvent(new CustomEvent('onFacilityUpdate', { detail: { id: facility.instanceId, breakdown: false } }));
  };

  const hasPricing = def.category === 'thrill' || def.category === 'gentle' || def.category === 'shop';

  return (
    <div className="facility-info-card">
      {/* Header */}
      <div className="fic-header">
        <div className="fic-title">
          <span className="fic-icon">{def.category === 'thrill' ? '🎢' : def.category === 'gentle' ? '🎠' : def.category === 'shop' ? '🍟' : def.category === 'scenery' ? '🌿' : '🏛'}</span>
          <span>{def.name}</span>
          {facility.breakdown && <AlertTriangle size={16} color="#E84855" />}
        </div>
        <button className="fic-close" onClick={() => selectFacility(null)}>
          <X size={16} />
        </button>
      </div>

      <div className="fic-divider" />

      {/* Stats */}
      <div className="fic-stats">
        {(def.category === 'thrill' || def.category === 'gentle') && (
          <>
            <div className="fic-stat-row">
              <span>排队</span>
              <strong>{queueCount} 人</strong>
              <span style={{ color: '#888', fontSize: 12 }}>等待约 {estimatedWaitMin} 分</span>
            </div>
            <div className="fic-stat-row">
              <span>正在游玩</span>
              <strong>{ridingCount} 人</strong>
            </div>
          </>
        )}
        <div className="fic-stat-row">
          <span>累计乘客</span>
          <strong>{facility.totalRides} 人</strong>
        </div>
        <div className="fic-stat-row">
          <span>设施年龄</span>
          <strong>{facility.age} 天</strong>
        </div>
        <div className="fic-stat-row">
          <span>故障率</span>
          <strong style={{ color: breakdownRate > 10 ? '#E84855' : '#44BBA4' }}>
            {breakdownRate.toFixed(1)}%
          </strong>
        </div>
        <div className="fic-stat-row">
          <span>状态</span>
          <strong style={{ color: facility.breakdown ? '#E84855' : '#44BBA4' }}>
            {facility.breakdown ? '⚠ 故障中' : '✓ 运行中'}
          </strong>
        </div>
      </div>

      {/* Pricing */}
      {hasPricing && (
        <>
          <div className="fic-divider" />
          <div className="fic-pricing">
            <label>定价</label>
            <div className="fic-price-control">
              <span className="fic-price-value">${currentPrice}</span>
              <input 
                type="range" 
                min={1} max={15} step={1} 
                value={currentPrice}
                onChange={e => handlePriceChange(Number(e.target.value))}
                className="fic-slider"
              />
              <span style={{ fontSize: 11, color: '#888' }}>默认 ${defaultPrice}</span>
            </div>
          </div>
        </>
      )}

      <div className="fic-divider" />

      {/* Actions */}
      <div className="fic-actions">
        {facility.breakdown && (
          <button className="fic-action-btn fic-repair" onClick={handleRepair}>
            <Wrench size={14} /> 维修
          </button>
        )}
        <button className="fic-action-btn fic-demolish" onClick={handleDemolish}>
          <Trash2 size={14} /> 拆除
        </button>
      </div>
    </div>
  );
};
