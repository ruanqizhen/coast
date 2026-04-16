import React, { useState } from 'react';
import { useParkState } from '../store/useParkState';
import { useGameState } from '../store/useGameState';
import type { TrackPieceType, CoasterTrackPiece, FacilityType } from '../types';
import { MoveRight, TrendingUp, TrendingDown, RefreshCcw, Check, X } from 'lucide-react';
import { CONSTANTS } from '../config/constants';

export function CoasterEditor() {
  const { currentCoasterPieces, addCoasterPiece, clearCoasterPieces, toggleCoasterBuilder, selectedFacilityToPlace } = useParkState();
  const deductMoney = useGameState(state => state.deductMoney);
  
  const [rotation, setRotation] = useState(0);

  const handleAddPiece = (type: TrackPieceType) => {
      // Calculate next position based on previous pieces and rotation
      let nx = CONSTANTS.GRID_SIZE / 2;
      let nz = CONSTANTS.GRID_SIZE / 2;
      
      if (currentCoasterPieces.length > 0) {
          const last = currentCoasterPieces[currentCoasterPieces.length - 1];
          // simple logic: move in direction of last rotation
          const rad = (last.rotation * Math.PI) / 180;
          nx = last.x + Math.round(Math.sin(rad)) * 2;
          nz = last.z + Math.round(Math.cos(rad)) * 2;
      }
      
      if (deductMoney(50)) { // 50 per track piece
          addCoasterPiece({
              x: nx, z: nz, type, rotation
          });
      }
  };

  const handleComplete = () => {
      // Check if closed loop in a real scenario.
      // For MVP, we just allow it if length > 4
      if (currentCoasterPieces.length >= 4) {
          window.dispatchEvent(new CustomEvent('onCoasterBuilt', { detail: { typeId: selectedFacilityToPlace, pieces: currentCoasterPieces }}));
          toggleCoasterBuilder(false);
          clearCoasterPieces();
      } else {
          alert('轨道过短，无法闭合！');
      }
  };

  const cancel = () => {
      // refund logic omitted for brevity
      toggleCoasterBuilder(false);
      clearCoasterPieces();
  };

  // Simple G Force simulation
  let maxG = 1;
  let currentSpeed = 0;
  for (let p of currentCoasterPieces) {
      if (p.type === 'climb') { currentSpeed -= 1; maxG = Math.max(maxG, 2); }
      if (p.type === 'dive') { currentSpeed += 3; maxG = Math.max(maxG, 3 + currentSpeed*0.5); }
      if (p.type === 'loop') { maxG = Math.max(maxG, 4 + currentSpeed*0.8); currentSpeed -= 2; }
  }

  return (
    <div className="hud-panel" style={{ width: 400, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <h3 style={{ margin: 0, fontSize: 16 }}>过山车编辑器</h3>
         <button onClick={cancel}><X size={16} /></button>
      </div>

      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--panel-border)', paddingBottom: 16 }}>
          <div style={{ flex: 1 }}>节数: <strong style={{ color: '#4DB8FF' }}>{currentCoasterPieces.length}</strong></div>
          <div style={{ flex: 1, color: maxG > 6 ? '#E84855' : '#44BBA4' }}>峰值 G 力: <strong>{maxG.toFixed(1)}G</strong></div>
      </div>
      
      {maxG > 6 && <div style={{ color: '#E84855', fontSize: 12 }}>警告：G 力超过 6G 可能会导致游客晕厥！</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>设置铺设方向：</div>
          <div style={{ display: 'flex', gap: 8 }}>
             <button onClick={() => setRotation((r) => (r - 90) % 360)} style={{ background: 'rgba(255,255,255,0.1)', padding: 4, borderRadius: 4 }}>左转</button>
             <div style={{ padding: 4 }}>{rotation}°</div>
             <button onClick={() => setRotation((r) => (r + 90) % 360)} style={{ background: 'rgba(255,255,255,0.1)', padding: 4, borderRadius: 4 }}>右转</button>
          </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
         <button onClick={() => handleAddPiece('straight')} style={{ padding: 12, background: '#2E86AB', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
             <MoveRight size={16} /> 直行 (-$50)
         </button>
         <button onClick={() => handleAddPiece('climb')} style={{ padding: 12, background: '#2E86AB', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
             <TrendingUp size={16} /> 爬升 (-$50)
         </button>
         <button onClick={() => handleAddPiece('dive')} style={{ padding: 12, background: '#2E86AB', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
             <TrendingDown size={16} /> 俯冲 (-$50)
         </button>
         <button onClick={() => handleAddPiece('loop')} style={{ padding: 12, background: '#2E86AB', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
             <RefreshCcw size={16} /> 回环 (-$50)
         </button>
      </div>

      <button onClick={handleComplete} style={{ marginTop: 8, padding: 12, background: '#44BBA4', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', width: '100%' }}>
          <Check size={16} /> 完成轨道闭合并测试
      </button>
    </div>
  );
}
