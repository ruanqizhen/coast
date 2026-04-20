import { createPortal } from 'react-dom';
import { useGameState } from '../store/useGameState';
import { TECH_TREE } from '../config/techtree';
import { X, Lock, Unlock, Beaker } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function ResearchTechTree({ onClose }: Props) {
  const { researchPoints, monthlyResearchBudget, unlockedTechs, setResearchBudget, unlockTech } = useGameState();

  const handleUnlock = (techId: string, cost: number) => {
    if (researchPoints >= cost) {
       useGameState.setState(s => ({ researchPoints: s.researchPoints - cost }));
       unlockTech(techId);
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="hud-panel" style={{ width: 700, height: 500, padding: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
             <Beaker size={20} color="#4DB8FF" /> 研发中心
          </h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: 24, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ flex: 1 }}>
               <div>当前可用科研点数: <strong style={{ color: '#4DB8FF', fontSize: 20 }}>{researchPoints} pts</strong></div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
               <label>调整每月研发投入: <strong style={{ color: 'var(--money-color)' }}>${monthlyResearchBudget}</strong></label>
               <input 
                  type="range" min="0" max="500" step="50" 
                  value={monthlyResearchBudget} 
                  onChange={e => setResearchBudget(Number(e.target.value))} 
               />
               <span style={{ fontSize: 12, color: '#888' }}>投入资金将在每月结算时按比例转化为科研点数。</span>
            </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
           {Object.values(TECH_TREE).map(node => {
               const isUnlocked = unlockedTechs.includes(node.id);
               const depMet = !node.dependsOn || unlockedTechs.includes(node.dependsOn);
               const canAfford = researchPoints >= node.cost;

               return (
                   <div key={node.id} style={{ 
                       width: 'calc(50% - 8px)', padding: 16, borderRadius: 8,
                       background: isUnlocked ? 'rgba(68, 187, 164, 0.1)' : 'rgba(255,255,255,0.05)',
                       border: isUnlocked ? '1px solid #44BBA4' : '1px solid rgba(255,255,255,0.1)',
                       opacity: depMet ? 1 : 0.4
                   }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                         <strong style={{ fontSize: 16 }}>{node.name}</strong>
                         {isUnlocked ? <Unlock size={16} color="#44BBA4" /> : <Lock size={16} color="#888" />}
                      </div>
                      <div style={{ fontSize: 13, color: '#aaa', marginBottom: 12 }}>
                         解锁: {node.facilityIds.join(', ')}
                      </div>
                      
                      {!isUnlocked && (
                          <button 
                             disabled={!depMet || !canAfford}
                             onClick={() => handleUnlock(node.id, node.cost)}
                             style={{ 
                                 width: '100%', padding: '8px 0', borderRadius: 4,
                                 background: (!depMet || !canAfford) ? '#333' : '#2E86AB',
                                 color: '#fff', cursor: (!depMet || !canAfford) ? 'not-allowed' : 'pointer'
                             }}>
                             解锁需要: {node.cost} pts
                          </button>
                      )}
                   </div>
               )
           })}
        </div>
      </div>
    </div>,
    document.body
  );
}
