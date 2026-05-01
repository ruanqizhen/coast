import { useState } from 'react';
import { useParkState } from '../store/useParkState';
import { useGameState } from '../store/useGameState';
import type { TrackPieceType } from '../types';
import { MoveRight, TrendingUp, TrendingDown, RefreshCcw, Check, X, Lock, Undo2, Wand2 } from 'lucide-react';
import { CONSTANTS } from '../config/constants';
import { findCoasterClosurePath } from '../utils/coasterPathfinder';

export function CoasterEditor() {
  const { currentCoasterPieces, addCoasterPiece, addCoasterPieces, undoCoasterPiece, clearCoasterPieces, toggleCoasterBuilder, selectedFacilityToPlace, exitPlacementMode } = useParkState();
  const deductMoney = useGameState(state => state.deductMoney);
  const addMoney = useGameState(state => state.addMoney);
  
  const [rotation, setRotation] = useState(0);
  const [slopeAngle, setSlopeAngle] = useState(0);

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
              x: nx, z: nz, type, rotation, slopeAngle
          });
      }
  };

  const handleUndo = () => {
      if (currentCoasterPieces.length > 0) {
          undoCoasterPiece();
          addMoney(50);
      }
  };

  // Simple G Force simulation
  let maxG = 1;
  let currentSpeed = 0;
  for (let p of currentCoasterPieces) {
      const slopeFactor = (p.slopeAngle || 0) / 45; // manual slope affects speed/g
      if (p.type === 'climb') { currentSpeed -= (1 + slopeFactor); maxG = Math.max(maxG, 2); }
      if (p.type === 'dive') { currentSpeed += (3 + slopeFactor); maxG = Math.max(maxG, 3 + currentSpeed*0.5); }
      if (p.type === 'loop') { maxG = Math.max(maxG, 4 + currentSpeed*0.8); currentSpeed -= 2; }
      if (p.type === 'straight') { currentSpeed *= 0.95; }
  }

  const isLoopClosed = () => {
      if (currentCoasterPieces.length < 4) return false;
      const first = currentCoasterPieces[0];
      const last = currentCoasterPieces[currentCoasterPieces.length - 1];
      
      // Calculate where the NEXT piece from last would be
      const rad = (last.rotation * Math.PI) / 180;
      const nx = last.x + Math.round(Math.sin(rad)) * 2;
      const nz = last.z + Math.round(Math.cos(rad)) * 2;
      
      // If next piece would land on first piece, or last is adjacent to first with correct rotation
      return nx === first.x && nz === first.z;
  };

  const handleComplete = () => {
      if (maxG > 6) {
          alert('G力过载！当前轨道设计不安全，请修改后再尝试。');
          return;
      }

      if (isLoopClosed()) {
          window.dispatchEvent(new CustomEvent('onCoasterBuilt', { detail: { typeId: selectedFacilityToPlace, pieces: currentCoasterPieces }}));
          toggleCoasterBuilder(false);
          clearCoasterPieces();
          exitPlacementMode();
      } else {
          alert('轨道未闭合！请确保最后一节轨道能够连回起点。');
      }
  };

  const handleAutoComplete = () => {
      if (currentCoasterPieces.length < 1) return;
      
      const first = currentCoasterPieces[0];
      const last = currentCoasterPieces[currentCoasterPieces.length - 1];

      let currentH = 0;
      for (const p of currentCoasterPieces) {
          if (p.type === 'climb') currentH += 1;
          if (p.type === 'dive') currentH -= 1;
      }

      const path = findCoasterClosurePath(
          last.x, last.z, currentH,
          first.x, first.z, 0, last.rotation
      );

      if (path) {
          const cost = path.length * 50;
          if (deductMoney(cost)) {
              let lx = last.x;
              let lz = last.z;
              let lRot = last.rotation;
              const newPieces: typeof currentCoasterPieces = [];
              
              path.forEach(act => {
                  const rad = (lRot * Math.PI) / 180;
                  const nx = lx + Math.round(Math.sin(rad)) * 2;
                  const nz = lz + Math.round(Math.cos(rad)) * 2;
                  newPieces.push({
                      x: nx, z: nz, type: act.type, rotation: act.rotation, slopeAngle: act.slopeAngle
                  });
                  lx = nx;
                  lz = nz;
                  lRot = act.rotation;
              });
              
              addCoasterPieces(newPieces);
          } else {
              alert(`资金不足！自动闭合需要 $${cost}`);
          }
      } else {
          alert('无法找到自动闭合的路线，请尝试调整末端位置或高度！');
      }
  };

  const cancel = () => {
      toggleCoasterBuilder(false);
      clearCoasterPieces();
      exitPlacementMode();
  };

  const canComplete = isLoopClosed() && maxG <= 6;

  return (
    <div className="hud-panel" style={{ width: 440, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <h3 style={{ margin: 0, fontSize: 16 }}>过山车编辑器 (Phase 3)</h3>
         <button onClick={cancel}><X size={16} /></button>
      </div>

      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--panel-border)', paddingBottom: 16, alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              轨道节数: <strong style={{ color: '#4DB8FF' }}>{currentCoasterPieces.length}</strong>
              <button onClick={handleUndo} disabled={currentCoasterPieces.length === 0} style={{ padding: '4px 8px', background: currentCoasterPieces.length > 0 ? '#E84855' : '#555', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4, cursor: currentCoasterPieces.length > 0 ? 'pointer' : 'not-allowed', marginLeft: 'auto' }}>
                  <Undo2 size={14} /> 撤销
              </button>
          </div>
          <div style={{ flex: 1, color: maxG > 6 ? '#E84855' : '#44BBA4' }}>
              峰值 G 力: <strong>{maxG.toFixed(1)}G</strong>
              {maxG > 6 && <Lock size={12} style={{ marginLeft: 4 }} />}
          </div>
      </div>
      
      {maxG > 6 && <div style={{ color: '#E84855', fontSize: 12, fontWeight: 600 }}>⚠️ 安全限制：G 力超过 6G 禁止运营！</div>}
      {!isLoopClosed() && currentCoasterPieces.length > 0 && <div style={{ color: '#888', fontSize: 12 }}>轨道尚未闭合 (首尾需相接)</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>铺设方向与坡度:</div>
          <div style={{ display: 'flex', gap: 8 }}>
             <button onClick={() => setRotation((r) => (r - 90 + 360) % 360)} className="glass-pill" style={{ padding: '2px 8px', fontSize: 12 }}>左转</button>
             <div style={{ padding: 4, fontSize: 12, minWidth: 40, textAlign: 'center' }}>{rotation}°</div>
             <button onClick={() => setRotation((r) => (r + 90) % 360)} className="glass-pill" style={{ padding: '2px 8px', fontSize: 12 }}>右转</button>
             
             <div style={{ width: 1, background: '#444', height: 16, margin: '0 4px' }} />
             
             <button onClick={() => setSlopeAngle((s) => Math.max(-45, s - 5))} className="glass-pill" style={{ padding: '2px 8px', fontSize: 12 }}>倾斜-</button>
             <div style={{ padding: 4, fontSize: 12, minWidth: 40, textAlign: 'center' }}>{slopeAngle}°</div>
             <button onClick={() => setSlopeAngle((s) => Math.min(45, s + 5))} className="glass-pill" style={{ padding: '2px 8px', fontSize: 12 }}>倾斜+</button>
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

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button 
            onClick={handleAutoComplete} 
            disabled={currentCoasterPieces.length < 1 || isLoopClosed()}
            style={{ 
                flex: 1, padding: 12, 
                background: (currentCoasterPieces.length > 0 && !isLoopClosed()) ? '#F4D03F' : '#333', color: '#111', fontWeight: 'bold',
                borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                cursor: (currentCoasterPieces.length > 0 && !isLoopClosed()) ? 'pointer' : 'not-allowed',
                opacity: (currentCoasterPieces.length > 0 && !isLoopClosed()) ? 1 : 0.6
            }}>
              <Wand2 size={16} /> 自动闭合
          </button>
          
          <button 
            onClick={handleComplete} 
            disabled={!canComplete}
            style={{ 
                flex: 1, padding: 12, 
                background: canComplete ? '#44BBA4' : '#333', 
                borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                cursor: canComplete ? 'pointer' : 'not-allowed',
                opacity: canComplete ? 1 : 0.6
            }}>
              <Check size={16} /> 完成轨道测试
          </button>
      </div>
    </div>
  );
}
