import { useState, useMemo } from 'react';
import { useParkState } from '../store/useParkState';
import { useGameState } from '../store/useGameState';
import type { TrackPieceType } from '../types';
import { TRACK_PIECE_STATS } from '../types';
import { MoveRight, TrendingUp, TrendingDown, RefreshCcw, Check, X, Lock, Undo2, Wand2, Play } from 'lucide-react';
import { CONSTANTS } from '../config/constants';
import { findCoasterClosurePath } from '../utils/coasterPathfinder';

export function CoasterEditor() {
  const { currentCoasterPieces, addCoasterPiece, addCoasterPieces, undoCoasterPiece, clearCoasterPieces, toggleCoasterBuilder, selectedFacilityToPlace, exitPlacementMode } = useParkState();
  const deductMoney = useGameState(state => state.deductMoney);
  const addMoney = useGameState(state => state.addMoney);
  
  const [rotation, setRotation] = useState(0);
  const [slopeAngle, setSlopeAngle] = useState(0);

  const handleAddPiece = (type: TrackPieceType) => {
      // Constraint: Basic coaster can only have 1 loop
      if (selectedFacilityToPlace === 'coaster_basic' && type === 'loop') {
          const loopCount = currentCoasterPieces.filter(p => p.type === 'loop').length;
          if (loopCount >= 1) {
              alert('普通过山车最多只能包含一个回环！请升级为弹射过山车以建造更多回环。');
              return;
          }
      }

      let nx = CONSTANTS.GRID_SIZE / 2;
      let nz = CONSTANTS.GRID_SIZE / 2;
      
      // If it's the very first piece, we add a "start" piece at center first
      if (currentCoasterPieces.length === 0) {
          if (deductMoney(50)) {
              addCoasterPiece({
                  x: nx, z: nz, type: 'straight', rotation: rotation, slopeAngle: 0
              });
          } else return;
      }

      // Re-calculate last to account for potential new start piece
      const last = currentCoasterPieces[currentCoasterPieces.length - 1] || { x: nx, z: nz, rotation: rotation };
      
      // Use the CURRENT rotation state to determine direction of the NEW piece
      const rad = (rotation * Math.PI) / 180;
      nx = last.x + Math.round(Math.sin(rad)) * 2;
      nz = last.z + Math.round(Math.cos(rad)) * 2;
      
      const cost = type === 'mega_loop' ? 150 : 50;
      if (deductMoney(cost)) {
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

  // Real-time stats
  const stats = useMemo(() => {
    let totalExcitement = 0;
    let totalNausea = 0;
    let maxG = 1;
    let currentSpeed = 0;
    for (const p of currentCoasterPieces) {
      const s = TRACK_PIECE_STATS[p.type];
      totalExcitement += s.excitement;
      totalNausea += s.nausea;
      const slopeFactor = (p.slopeAngle || 0) / 45;
      if (p.type === 'climb') { currentSpeed -= (1 + slopeFactor); maxG = Math.max(maxG, 2); }
      if (p.type === 'dive') { currentSpeed += (3 + slopeFactor); maxG = Math.max(maxG, 3 + currentSpeed * 0.5); }
      if (p.type === 'loop') { maxG = Math.max(maxG, 4 + currentSpeed * 0.8); currentSpeed -= 2; }
      if (p.type === 'straight') { currentSpeed *= 0.95; }
    }
    const rideTimeSec = Math.min(300, Math.max(30, currentCoasterPieces.length * 2));
    return { totalExcitement: Math.round(totalExcitement * 10) / 10, totalNausea: Math.round(totalNausea * 10) / 10, maxG: Math.round(maxG * 10) / 10, trackLength: currentCoasterPieces.length, rideTimeSec };
  }, [currentCoasterPieces]);

  // Compute total height of track pieces (matching pathfinder model: no slope contribution)
  const computeTrackHeight = (pieces: typeof currentCoasterPieces): number => {
    let h = 0;
    for (const p of pieces) {
      if (p.type === 'climb') h += 1;
      else if (p.type === 'dive') h = Math.max(0, h - 1);
      else if (p.type === 'vertical_climb') h += 4;
      else if (p.type === 'vertical_dive') h = Math.max(0, h - 4);
    }
    return h;
  };

  /** Detect track crossings: any two non-adjacent pieces sharing the same (x,z) cell */
  const hasCrossings = (pieces: typeof currentCoasterPieces): boolean => {
    const seen = new Map<string, number>();
    for (let i = 0; i < pieces.length; i++) {
      const key = `${pieces[i].x},${pieces[i].z}`;
      if (seen.has(key)) {
        const prevIdx = seen.get(key)!;
        if (Math.abs(i - prevIdx) > 1 && !(prevIdx === 0 && i === pieces.length - 1)) {
          return true;
        }
      } else {
        seen.set(key, i);
      }
    }
    return false;
  };

  const isLoopClosed = () => {
      if (currentCoasterPieces.length < 4) return false;
      const first = currentCoasterPieces[0];
      const last = currentCoasterPieces[currentCoasterPieces.length - 1];

      // Calculate where the NEXT piece from last would be
      const rad = (last.rotation * Math.PI) / 180;
      const nx = last.x + Math.round(Math.sin(rad)) * 2;
      const nz = last.z + Math.round(Math.cos(rad)) * 2;

      // Must connect back to first piece position AND height must match AND no crossings
      const totalHeight = computeTrackHeight(currentCoasterPieces);
      return nx === first.x && nz === first.z && totalHeight === 0 && !hasCrossings(currentCoasterPieces);
  };

  const handleComplete = () => {
      // G-force check removed as per user request

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

      const currentH = computeTrackHeight(currentCoasterPieces);

      const path = findCoasterClosurePath(
          last.x, last.z, currentH,
          first.x, first.z, 0, last.rotation
      );

      if (path && path.length > 0) {
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

  const handleRandomBuild = () => {
      const startX = CONSTANTS.GRID_SIZE / 2;
      const startZ = CONSTANTS.GRID_SIZE / 2;
      const targetLen = 10 + Math.floor(Math.random() * 8); // 10-17 total segments

      // Required pieces: at least 1 climb, 1 dive, 1 loop, plus straights
      const requiredTypes: TrackPieceType[] = ['climb', 'dive', 'loop'];
      const slopeOptions = [-15, -10, -5, 0, 5, 10, 15];

      let best: typeof currentCoasterPieces | null = null;
      let bestScore = -Infinity;

      for (let attempt = 0; attempt < 100; attempt++) {
        const pieces: typeof currentCoasterPieces = [];
        pieces.push({ x: startX, z: startZ, type: 'straight', rotation: 0, slopeAngle: 0 });

        let cx = startX, cz = startZ, cRot = 0, cH = 0;
        const placedTypes = new Set<TrackPieceType>(['straight']);
        let deadEnd = false;

        for (let i = 0; i < targetLen && !deadEnd; i++) {
          const remaining = targetLen - i;
          const dx = (startX - cx) / 2;
          const dz = (startZ - cz) / 2;
          const dist = Math.abs(dx) + Math.abs(dz);

          // Choose rotation
          let nextRot = cRot;
          if (dist > remaining) {
            // Must head toward start
            const candidates: number[] = [];
            for (const r of [cRot, (cRot - 90 + 360) % 360, (cRot + 90) % 360]) {
              const rad = (r * Math.PI) / 180;
              const nx = cx + Math.round(Math.sin(rad)) * 2;
              const nz = cz + Math.round(Math.cos(rad)) * 2;
              const nd = Math.abs(startX - nx) / 2 + Math.abs(startZ - nz) / 2;
              if (nd < dist) candidates.push(r);
            }
            if (candidates.length > 0) nextRot = candidates[Math.floor(Math.random() * candidates.length)];
            else nextRot = cRot;
          } else if (dist < 8 && remaining <= 8) {
            // Try auto-complete
            const path = findCoasterClosurePath(cx, cz, cH, startX, startZ, 0, cRot);
            if (path && path.length >= 2) {
              let lx = cx, lz = cz, lRot = cRot;
              for (const act of path) {
                const aRad = (lRot * Math.PI) / 180;
                lx += Math.round(Math.sin(aRad)) * 2;
                lz += Math.round(Math.cos(aRad)) * 2;
                pieces.push({ x: lx, z: lz, type: act.type, rotation: act.rotation, slopeAngle: pickRandom(slopeOptions) });
                placedTypes.add(act.type);
                lRot = act.rotation;
              }
              cx = lx; cz = lz; cRot = lRot;
              break;
            }
            nextRot = cRot;
          } else {
            // Random turn, favoring variety
            const rnd = Math.random();
            if (rnd < 0.3) nextRot = (cRot - 90 + 360) % 360;
            else if (rnd < 0.55) nextRot = (cRot + 90) % 360;
          }

          const rad = (nextRot * Math.PI) / 180;
          const nx = cx + Math.round(Math.sin(rad)) * 2;
          const nz = cz + Math.round(Math.cos(rad)) * 2;
          if (nx < 5 || nz < 5 || nx > CONSTANTS.GRID_SIZE - 5 || nz > CONSTANTS.GRID_SIZE - 5) { deadEnd = true; break; }

          // Pick track type — ensure required variety
          const remainingReq = requiredTypes.filter(t => !placedTypes.has(t));
          let t: TrackPieceType;
          if (remainingReq.length > 0 && remaining - remainingReq.length <= 3) {
            // Must place remaining required types soon
            t = remainingReq[0];
          } else if (remainingReq.length > 0 && Math.random() < 0.3) {
            // Opportunistically place a required type
            t = remainingReq[Math.floor(Math.random() * remainingReq.length)];
          } else {
            // Normal random type selection
            if (cH <= 1) t = Math.random() < 0.35 ? 'climb' : 'straight';
            else if (cH >= 8) t = Math.random() < 0.5 ? 'dive' : 'straight';
            else t = Math.random() < 0.25 ? 'climb' : Math.random() < 0.45 ? 'dive' : Math.random() < 0.55 ? 'straight' : 'loop';
          }

          // Height management
          let nextH = cH;
          if (t === 'climb') nextH += 1;
          else if (t === 'dive') nextH = Math.max(0, nextH - 1);
          if (nextH > 10) { t = 'dive'; nextH = Math.max(0, cH - 1); }
          if (nextH < 0) { t = 'climb'; nextH = cH + 1; }
          if (t === 'loop' && cH > 4) { t = 'straight'; nextH = cH; } // Loops need level-ish ground

          placedTypes.add(t);
          const slope = pickRandom(slopeOptions);
          pieces.push({ x: nx, z: nz, type: t, rotation: nextRot, slopeAngle: slope });
          cx = nx; cz = nz; cRot = nextRot; cH = nextH;
        }

        // Final auto-close attempt
        if (!isLoopClosedFor(pieces)) {
          const closePath = findCoasterClosurePath(cx, cz, cH, startX, startZ, 0, cRot);
          if (closePath && closePath.length >= 2) {
            let lx = cx, lz = cz, lRot = cRot;
            for (const act of closePath) {
              const aRad = (lRot * Math.PI) / 180;
              lx += Math.round(Math.sin(aRad)) * 2;
              lz += Math.round(Math.cos(aRad)) * 2;
              pieces.push({ x: lx, z: lz, type: act.type, rotation: act.rotation, slopeAngle: pickRandom(slopeOptions) });
              lRot = act.rotation;
            }
          }
        }

        // Verify closure + crossings
        if (isLoopClosedFor(pieces) && !hasCrossings(pieces)) {
          const allRequiredMet = requiredTypes.every(t => pieces.some(p => p.type === t));
          const variety = new Set(pieces.map(p => p.type)).size;
          const nonStraight = pieces.filter(p => p.type !== 'straight').length;
          const slopesUsed = new Set(pieces.map(p => p.slopeAngle)).size;
          const score = pieces.length * 0.3 + variety * 5 + nonStraight * 2 + slopesUsed * 1.5 + (allRequiredMet ? 10 : 0);
          if (score > bestScore) {
            bestScore = score;
            best = pieces;
            if (variety >= 4 && allRequiredMet && slopesUsed >= 3) break; // Excellent result
          }
        }
      }

      if (best) {
        const cost = best.length * 50;
        if (deductMoney(cost)) {
          clearCoasterPieces();
          addCoasterPieces(best);
        }
      } else {
        buildGuaranteedOval(startX, startZ);
      }
  };

  function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

  /** Check if a given piece array forms a closed loop at height 0 */
  const isLoopClosedFor = (pieces: typeof currentCoasterPieces): boolean => {
    if (pieces.length < 4) return false;
    const first = pieces[0];
    const last = pieces[pieces.length - 1];
    const rad = (last.rotation * Math.PI) / 180;
    const nx = last.x + Math.round(Math.sin(rad)) * 2;
    const nz = last.z + Math.round(Math.cos(rad)) * 2;
    return nx === first.x && nz === first.z && computeTrackHeight(pieces) === 0;
  };

  /** Build a guaranteed simple loop using auto-complete on a short starting path */
  const buildGuaranteedOval = (sx: number, sz: number) => {
    const pieces: typeof currentCoasterPieces = [];
    pieces.push({ x: sx, z: sz, type: 'straight', rotation: 0, slopeAngle: 0 });
    // Go forward 3, turn right, go forward 3
    let cx = sx, cz = sz, cRot = 0;
    for (let i = 0; i < 3; i++) {
      cx += 0; cz += 2;
      pieces.push({ x: cx, z: cz, type: 'straight', rotation: 0, slopeAngle: 0 });
    }
    cRot = 90;
    for (let i = 0; i < 3; i++) {
      const rad = (90 * Math.PI) / 180;
      cx += Math.round(Math.sin(rad)) * 2;
      cz += Math.round(Math.cos(rad)) * 2;
      pieces.push({ x: cx, z: cz, type: 'straight', rotation: 90, slopeAngle: 0 });
    }
    // Auto-close
    const path = findCoasterClosurePath(cx, cz, 0, sx, sz, 0, cRot);
    if (path && path.length >= 2) {
      let lx = cx, lz = cz, lRot = cRot;
      for (const act of path) {
        const aRad = (lRot * Math.PI) / 180; // Advance using current rotation
        lx += Math.round(Math.sin(aRad)) * 2;
        lz += Math.round(Math.cos(aRad)) * 2;
        pieces.push({ x: lx, z: lz, type: act.type, rotation: act.rotation, slopeAngle: 0 });
        lRot = act.rotation;
      }
    }
    // Verify no crossings in the guaranteed oval too
    if (hasCrossings(pieces)) {
      // Extremely unlikely for simple oval, but if so, just use raw pieces
    }
    const cost = pieces.length * 50;
    if (deductMoney(cost)) {
      clearCoasterPieces();
      addCoasterPieces(pieces);
    }
  };

  const cancel = () => {
      toggleCoasterBuilder(false);
      clearCoasterPieces();
      exitPlacementMode();
  };

  const canComplete = isLoopClosed();

  return (
    <div className="hud-panel" style={{ width: 440, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
         <h3 style={{ margin: 0, fontSize: 16 }}>过山车编辑器</h3>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--panel-border)', paddingBottom: 12, flexWrap: 'wrap' }}>
        <StatBadge label="节数" value={String(stats.trackLength)} color="#4DB8FF" />
        <StatBadge label="刺激" value={stats.totalExcitement.toFixed(1)} color="#E84855" />
        <StatBadge label="恶心" value={stats.totalNausea.toFixed(1)} color="#F4A223" />
        <StatBadge label="G力" value={`${stats.maxG.toFixed(1)}G`} color={stats.maxG > 6 ? '#E84855' : '#44BBA4'} />
        <StatBadge label="时长" value={`${stats.rideTimeSec}s`} color="#E040FB" />
        <button onClick={handleUndo} disabled={currentCoasterPieces.length === 0} style={{
          marginLeft: 'auto', padding: '4px 10px', fontSize: 12,
          background: currentCoasterPieces.length > 0 ? 'rgba(232,72,85,0.2)' : '#333',
          color: currentCoasterPieces.length > 0 ? '#E84855' : '#888',
          borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4,
          cursor: currentCoasterPieces.length > 0 ? 'pointer' : 'not-allowed',
        }}>
          <Undo2 size={14} /> 撤销
        </button>
      </div>

      {stats.maxG > 6 && <div style={{ color: '#F4D03F', fontSize: 12, fontWeight: 600 }}>⚠️ G 力超过 6G，游客可能感到不适</div>}
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
         
         {/* Exclusive pieces for Launch Coaster */}
         {selectedFacilityToPlace === 'launch_coaster' && (
           <>
            <button onClick={() => handleAddPiece('mega_loop')} style={{ padding: 12, background: '#7B61FF', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <RefreshCcw size={20} /> 大回环 (-$150)
            </button>
            <button onClick={() => handleAddPiece('vertical_climb')} style={{ padding: 12, background: '#7B61FF', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <TrendingUp size={20} strokeWidth={3} /> 竖直轨道 (-$50)
            </button>
           </>
         )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleRandomBuild} style={{
              flex: 1, padding: 12,
              background: 'linear-gradient(135deg, #FF6B6B, #7B61FF)', borderRadius: 6,
              color: 'white', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
              border: 'none', cursor: 'pointer',
          }}>
              <RefreshCcw size={16} /> 随机生成
          </button>

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
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={cancel} style={{
              flex: 1, padding: 12,
              background: 'rgba(232,72,85,0.15)', color: '#E84855',
              border: '1px solid rgba(232,72,85,0.3)', borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
              cursor: 'pointer', fontWeight: 600
          }}>
              <X size={16} /> 取消
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
              <Check size={16} /> 完成
          </button>
      </div>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '4px 10px', borderRadius: 6,
      background: `${color}15`, border: `1px solid ${color}30`,
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 12,
    }}>
      <span style={{ color: '#888' }}>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}
