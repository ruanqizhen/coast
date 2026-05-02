import React, { useEffect, useState, useRef } from 'react';
import { X, Save, Trash2, Download, Upload, Clock } from 'lucide-react';
import { saveManager } from '../engine/SaveSystem';
import { useGameState } from '../store/useGameState';
import { useParkState } from '../store/useParkState';
import type { SaveData } from '../types';

interface SaveLoadModalProps {
  onClose: () => void;
}

export function SaveLoadModal({ onClose }: SaveLoadModalProps) {
  const [saves, setSaves] = useState<{ id: string; name: string; updatedAt: string }[]>([]);
  const [newSaveName, setNewSaveName] = useState(useGameState.getState().parkName || '我的海岸公园');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSaves = async () => {
    const list = await saveManager.listSaves();
    // Sort by updated descending
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setSaves(list);
  };

  useEffect(() => {
    loadSaves();
  }, []);

  const handleCreateSave = async () => {
    const gState = useGameState.getState();
    const pState = useParkState.getState();
    
    const data: SaveData = {
        version: "1.0.0",
        park: {
            name: newSaveName,
            size: gState.gridSize,
            money: gState.money,
            date: { day: gState.day, month: gState.month },
            rating: gState.rating,
            stars: gState.stars,
            settings: { ticketMode: gState.ticketMode, ticketPrice: gState.ticketPrice, speedMultiplier: gState.speed }
        },
        roads: pState.roads,
        facilities: pState.facilities,
        staff: Object.values(pState.staff).map(s => ({ id: s.id, type: s.type, zone: s.patrolZone })),
        research: { monthlyBudget: gState.monthlyResearchBudget, accumulatedPoints: gState.researchPoints, unlocked: gState.unlockedTechs },
        visitors: Object.values(pState.visitors),
        economy: { loan: gState.loan, historicalData: gState.historicalData },
        weather: gState.weather,
        nextWeather: gState.nextWeather
    };
    
    const id = `save_${Date.now()}`;
    gState.setSaving(true);
    await saveManager.save(id, data);
    gState.setSaving(false);
    gState.addMessage({ id: `msg_${Date.now()}`, text: `游戏已保存: ${newSaveName}`, priority: 'info', timestamp: Date.now() });
    loadSaves();
  };

  const handleLoad = async (id: string) => {
    const data = await saveManager.load(id);
    if (data) {
        window.dispatchEvent(new CustomEvent('onGameLoaded', { detail: data }));
        useGameState.getState().addMessage({ id: `msg_${Date.now()}`, text: "游戏已读取", priority: 'info', timestamp: Date.now() });
        onClose();
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('确定要删除这个存档吗？')) {
        await saveManager.deleteSave(id);
        loadSaves();
    }
  };

  const handleExport = async (id: string) => {
    await saveManager.exportToJson(id);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const id = await saveManager.importFromJson(file);
        if (id) {
            useGameState.getState().addMessage({ id: `msg_${Date.now()}`, text: "存档导入成功", priority: 'info', timestamp: Date.now() });
            loadSaves();
        } else {
            alert('导入失败，文件格式不正确');
        }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="hud-panel" style={{ width: 600, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <h2 style={{ margin: 0, fontSize: 20 }}>存档管理</h2>
           <button onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
            <input 
              type="text" 
              value={newSaveName} 
              onChange={e => setNewSaveName(e.target.value)} 
              className="glass-pill" 
              style={{ flex: 1, border: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.2)' }}
              placeholder="存档名称..."
            />
            <button onClick={handleCreateSave} style={{ background: '#44BBA4', padding: '8px 16px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', border: 'none', color: 'white' }}>
                <Save size={16} /> 新建存档
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={{ background: '#2E86AB', padding: '8px 16px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', border: 'none', color: 'white' }}>
                <Upload size={16} /> 导入 JSON
            </button>
            <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImport} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
            {saves.map(save => (
                <div key={save.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px solid var(--panel-border)' }}>
                    <div>
                        <div style={{ fontWeight: 'bold', fontSize: 16 }}>{save.name}</div>
                        <div style={{ color: '#aaa', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <Clock size={12} /> {new Date(save.updatedAt).toLocaleString()}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleLoad(save.id)} style={{ padding: '6px 12px', background: '#2E86AB', borderRadius: 4, cursor: 'pointer', border: 'none', color: 'white' }}>读取</button>
                        <button onClick={() => handleExport(save.id)} style={{ padding: '6px', background: '#333', borderRadius: 4, cursor: 'pointer', border: 'none', color: 'white' }} title="导出"><Download size={16} /></button>
                        <button onClick={() => handleDelete(save.id)} style={{ padding: '6px', background: '#E84855', borderRadius: 4, cursor: 'pointer', border: 'none', color: 'white' }} title="删除"><Trash2 size={16} /></button>
                    </div>
                </div>
            ))}
            {saves.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>暂无存档记录</div>
            )}
        </div>
      </div>
    </div>
  );
}
