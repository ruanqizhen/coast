import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useGameState } from '../store/useGameState';
import { useParkState } from '../store/useParkState';
import { FACILITIES, DEFAULT_TICKET_PRICES } from '../config/facilities';
import { X, Settings, Volume2, VolumeX } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: Props) {
  const { ticketMode, ticketPrice, setTicketMode, setTicketPrice } = useGameState();
  const { facilities, updateFacility } = useParkState();

  const [audioEnabled, setAudioEnabled] = useState(() => {
    try { return localStorage.getItem('coast_audio_enabled') !== 'false'; } catch { return true; }
  });
  const [sfxVolume, setSfxVolume] = useState(() => {
    try { return Number(localStorage.getItem('coast_sfx_volume') ?? 0.7); } catch { return 0.7; }
  });
  const [bgmVolume, setBgmVolume] = useState(() => {
    try { return Number(localStorage.getItem('coast_bgm_volume') ?? 0.15); } catch { return 0.15; }
  });

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    try { localStorage.setItem('coast_audio_enabled', String(next)); } catch {}
    window.dispatchEvent(new CustomEvent('onSetAudioEnabled', { detail: next }));
  };

  const updateSfxVolume = (v: number) => {
    setSfxVolume(v);
    try { localStorage.setItem('coast_sfx_volume', String(v)); } catch {}
    window.dispatchEvent(new CustomEvent('onSetSFXVolume', { detail: v }));
  };

  const updateBgmVolume = (v: number) => {
    setBgmVolume(v);
    try { localStorage.setItem('coast_bgm_volume', String(v)); } catch {}
    window.dispatchEvent(new CustomEvent('onSetBGMVolume', { detail: v }));
  };

  // Filter facilities that can have prices
  const pricableFacilities = facilities.filter(f => {
      const def = FACILITIES[f.typeId];
      return def && (def.category === 'thrill' || def.category === 'gentle' || def.category === 'shop');
  });

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
    }}>
      <div className="hud-panel" style={{ width: 600, height: 500, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={22} color="var(--primary-color)" /> 公园综合管理
          </h2>
          <button onClick={onClose} className="fic-close"><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24, paddingRight: 8 }}>
          
          {/* Section 1: Park Entrance */}
          <section>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, margin: 0, borderLeft: '4px solid #44BBA4', paddingLeft: 10 }}>公园门票 (入场费)</h3>
                <span style={{ fontSize: 12, color: ticketMode === 'free' ? '#44BBA4' : '#F4A223', fontWeight: 600 }}>
                   {ticketMode === 'free' ? '当前: 免费入园' : `当前: 收费 $${ticketPrice}`}
                </span>
             </div>
             <div style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                   <button 
                     onClick={() => setTicketMode('free')}
                     style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: ticketMode === 'free' ? '#44BBA4' : '#222', color: ticketMode === 'free' ? '#111' : '#888', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                   >
                     免费
                   </button>
                   <button 
                     onClick={() => setTicketMode('paid')}
                     style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: ticketMode === 'paid' ? '#44BBA4' : '#222', color: ticketMode === 'paid' ? '#111' : '#888', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                   >
                     收费
                   </button>
                </div>

                {ticketMode === 'paid' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, animation: 'fadeIn 0.3s' }}>
                     <div style={{ minWidth: 60, fontSize: 24, fontWeight: 800, color: '#F4A223', textAlign: 'center' }}>${ticketPrice}</div>
                     <div style={{ flex: 1 }}>
                        <input 
                          type="range" min="0" max="50" step="1"
                          value={ticketPrice}
                          onChange={(e) => setTicketPrice(Number(e.target.value))}
                          style={{ width: '100%', accentColor: '#F4A223' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555', marginTop: 4 }}>
                           <span>$0 (免费)</span>
                           <span>$25 (中等)</span>
                           <span>$50 (极高)</span>
                        </div>
                     </div>
                  </div>
                )}
             </div>
          </section>

          {/* Audio Settings */}
          <section>
             <h3 style={{ fontSize: 16, margin: '0 0 12px 0', borderLeft: '4px solid #E040FB', paddingLeft: 10 }}>音频设置</h3>
             <div style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <button onClick={toggleAudio} style={{
                   padding: '12px 20px', borderRadius: 8, border: 'none',
                   background: audioEnabled ? '#44BBA4' : '#E84855',
                   color: '#111', fontWeight: 600, cursor: 'pointer',
                   display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', width: 'fit-content'
                }}>
                   {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                   {audioEnabled ? '音效已开启' : '音效已关闭'}
                </button>
                {audioEnabled && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                       <span style={{ minWidth: 70, fontSize: 13, color: '#aaa' }}>音效音量</span>
                       <input type="range" min="0" max="100" step="5"
                         value={Math.round(sfxVolume * 100)}
                         onChange={(e) => updateSfxVolume(Number(e.target.value) / 100)}
                         style={{ flex: 1, accentColor: '#44BBA4' }}
                       />
                       <span style={{ minWidth: 35, fontSize: 13, color: '#44BBA4' }}>{Math.round(sfxVolume * 100)}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                       <span style={{ minWidth: 70, fontSize: 13, color: '#aaa' }}>音乐音量</span>
                       <input type="range" min="0" max="100" step="5"
                         value={Math.round(bgmVolume * 100)}
                         onChange={(e) => updateBgmVolume(Number(e.target.value) / 100)}
                         style={{ flex: 1, accentColor: '#E040FB' }}
                       />
                       <span style={{ minWidth: 35, fontSize: 13, color: '#E040FB' }}>{Math.round(bgmVolume * 100)}%</span>
                    </div>
                  </>
                )}
             </div>
          </section>

          {/* Section 2: Facility Prices */}
          <section>
             <h3 style={{ fontSize: 16, margin: '0 0 12px 0', borderLeft: '4px solid #2E86AB', paddingLeft: 10 }}>设施票价清单</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pricableFacilities.length > 0 ? pricableFacilities.map(fac => {
                  const def = FACILITIES[fac.typeId];
                  const dPrice = DEFAULT_TICKET_PRICES[fac.typeId] || 5;
                  const cPrice = fac.ticketPrice || dPrice;

                  return (
                    <div key={fac.instanceId} className="setting-row" style={{ background: 'rgba(255,255,255,0.03)', padding: '14px 18px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 20, border: '1px solid rgba(255,255,255,0.05)' }}>
                       <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                          {def.category === 'thrill' ? '🎢' : def.category === 'gentle' ? '🎠' : '🍟'}
                       </div>
                       <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{def.name}</div>
                          <div style={{ fontSize: 11, color: '#666' }}>ID: {fac.instanceId.split('_')[1]}</div>
                       </div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 2 }}>
                          <div style={{ minWidth: 45, textAlign: 'right', fontWeight: 800, color: '#4DB8FF', fontSize: 16 }}>${cPrice}</div>
                          <div style={{ flex: 1 }}>
                            <input 
                               type="range" min="1" max="40" step="1"
                               value={cPrice}
                               onChange={(e) => updateFacility(fac.instanceId, { ticketPrice: Number(e.target.value) })}
                               style={{ width: '100%', accentColor: '#4DB8FF' }}
                            />
                          </div>
                       </div>
                    </div>
                  );
                }) : (
                  <div style={{ textAlign: 'center', padding: 30, color: '#555', border: '1px dashed #333', borderRadius: 12, fontSize: 13 }}>
                    尚未建造任何可收费的设施 (过山车、平缓设施、商店等)
                  </div>
                )}
             </div>
          </section>

        </div>


        {/* Footer */}
        <div style={{ textAlign: 'right', fontSize: 12, color: '#555', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
          所有修改将立即生效
        </div>
      </div>
      <style>{`
        input[type="range"] { cursor: pointer; }
      `}</style>
    </div>,
    document.body
  );
}
