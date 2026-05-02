import { useEffect, useRef, useCallback, useState } from 'react';
import { HUD } from './components/HUD';
import { BuildBar } from './components/BuildBar';
import { CoasterEditor } from './components/CoasterEditor';
import { BabylonCanvas } from './components/BabylonCanvas';
import { useGameState } from './store/useGameState';
import { useParkState } from './store/useParkState';
import { MessageFeed } from './components/MessageFeed';
import { MiniMap } from './components/MiniMap';
import { FacilityInfoCard } from './components/FacilityInfoCard';
import { VisitorInfoCard } from './components/VisitorInfoCard';
import { TutorialOverlay } from './components/TutorialOverlay';
import { TitleScreen } from './components/TitleScreen';
import { saveManager } from './engine/SaveSystem';
import { CONSTANTS } from './config/constants';
import type { PlacedFacility, SaveData } from './types';

export function App() {
  const workerRef = useRef<Worker | null>(null);
  const speed = useGameState(state => state.speed);
  const gamePaused = useGameState(state => state.gamePaused);
  const facilities = useParkState(state => state.facilities);
  const selectedFacilityId = useParkState(state => state.selectedFacilityId);
  const selectedVisitorId = useParkState(state => state.selectedVisitorId);
  const isSaving = useGameState(state => state.isSaving);
  const [showTitle, setShowTitle] = useState(() => {
    try { return localStorage.getItem('coast_returning') !== 'true'; } catch { return true; }
  });
  const [showTutorial, setShowTutorial] = useState(() => {
    try { return localStorage.getItem('coast_tutorial_done') !== 'true'; } catch { return true; }
  });

  // ═══════════════════════════════════
  // Auto-save every 5 minutes (PRD §8.6)
  // ═══════════════════════════════════
  const doAutoSave = useCallback(async () => {
    const gState = useGameState.getState();
    const pState = useParkState.getState();

    const data: SaveData = {
      version: "1.0.0",
      park: {
        name: gState.parkName,
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

    gState.setSaving(true);
    await saveManager.save('autosave_coast_1', data);
    gState.setSaving(false);
    gState.addMessage({ id: `msg_${Date.now()}`, text: "💾 自动保存完成", priority: 'info', timestamp: Date.now() });
  }, []);

  useEffect(() => {
    const autoSaveInterval = setInterval(doAutoSave, CONSTANTS.AUTO_SAVE_INTERVAL);
    return () => clearInterval(autoSaveInterval);
  }, [doAutoSave]);

  // ═══════════════════════════════════
  // Worker Init
  // ═══════════════════════════════════
  useEffect(() => {
    // Initialize Web Worker
    workerRef.current = new Worker(new URL('./workers/simulation.worker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data;
      const gState = useGameState.getState();
      const pState = useParkState.getState();
      
      if (type === 'DAY_TICK') {
        gState.advanceDay();
        // Day/night cycle: dispatch day tick for light rotation
        window.dispatchEvent(new CustomEvent('onDayTick'));
      } else if (type === 'SIM_UPDATE') {
        // Delta protocol: merge changes + handle removals
        if (payload.visitors || payload.removedVisitors) {
          const currentVisitors = { ...useParkState.getState().visitors };
          if (payload.visitors) {
            for (const id in payload.visitors) currentVisitors[id] = payload.visitors[id];
          }
          if (payload.removedVisitors) {
            for (const id of payload.removedVisitors) delete currentVisitors[id];
          }
          pState.setVisitors(currentVisitors);
        }
        if (payload.staff || payload.removedStaff) {
          const currentStaff = { ...useParkState.getState().staff };
          if (payload.staff) {
            for (const id in payload.staff) currentStaff[id] = payload.staff[id];
          }
          if (payload.removedStaff) {
            for (const id of payload.removedStaff) delete currentStaff[id];
          }
          pState.setStaff(currentStaff);
        }
        pState.setVomitPoints(payload.vomitPoints);
        gState.setVisitorsCount(Object.keys(useParkState.getState().visitors).length);
      } else if (type === 'WEATHER_UPDATE') {
        gState.setWeather(payload.current, payload.next);
        // Rain sounds
        if (payload.current === 'light_rain') {
          window.dispatchEvent(new CustomEvent('onRainStart', { detail: { heavy: false } }));
        } else if (payload.current === 'heavy_rain') {
          window.dispatchEvent(new CustomEvent('onRainStart', { detail: { heavy: true } }));
        } else {
          window.dispatchEvent(new CustomEvent('onRainStop'));
        }
      } else if (type === 'RATING_UPDATE') {
        gState.setRating(payload);
      } else if (type === 'ECONOMY_UPDATE') {
        gState.addMoney(payload.amount);
      } else if (type === 'FACILITY_BREAKDOWN') {
         window.dispatchEvent(new CustomEvent('onFacilityUpdate', { detail: { id: payload, breakdown: true }}));
         window.dispatchEvent(new CustomEvent('onBreakdownAlarm'));
      } else if (type === 'FACILITY_FIXED') {
         window.dispatchEvent(new CustomEvent('onFacilityUpdate', { detail: { id: payload, breakdown: false }}));
      } else if (type === 'MESSAGE') {
         gState.addMessage(payload);
      } else if (type === 'STAR_UPDATE') {
         gState.setStars(payload);
         window.dispatchEvent(new CustomEvent('onStarUp', { detail: payload }));
      } else if (type === 'LOAN_UPDATE') {
         gState.setLoan(payload);
      }
    };

    workerRef.current.onerror = (err) => {
      console.error("Simulation Worker Error:", err);
      useGameState.getState().addMessage({
        id: `err_${Date.now()}`,
        text: "🚨 模拟引擎发生错误，正在尝试重新连接...",
        priority: 'critical',
        timestamp: Date.now()
      });
    };

    // Explicitly start the simulation
    workerRef.current.postMessage({ type: 'START' });

    return () => {
      workerRef.current?.terminate();
    };
  }, []); 

  // Setup event listener for facility updates to update zustand
  useEffect(() => {
     const handleUpdate = (e: any) => {
         const { id, breakdown } = e.detail;
         useParkState.setState(state => ({
             facilities: state.facilities.map(f => f.instanceId === id ? { ...f, breakdown } : f)
         }));
     };
     window.addEventListener('onFacilityUpdate', handleUpdate);

     const handleRoadPlaced = (e: any) => {
         const { type: roadType, x, z } = e.detail;
         const { deductMoney } = useGameState.getState();
         const { addRoad } = useParkState.getState();
         const cost = roadType === 'normal' ? 5 : roadType === 'wide' ? 9 : 3;
         if (deductMoney(cost)) {
             addRoad({ x, z, type: roadType });
             window.dispatchEvent(new CustomEvent('onPlayPlaceSound'));
             // Sync road grid to worker
             const roads = useParkState.getState().roads;
             const gridSize = useGameState.getState().gridSize;
             const flatGrid: (string | null)[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
             for (const r of roads) {
                 if (r.x >= 0 && r.z >= 0 && r.x < gridSize && r.z < gridSize) {
                     flatGrid[r.x][r.z] = r.type;
                 }
             }
             // Also add the new one
             if (x >= 0 && z >= 0 && x < gridSize && z < gridSize) {
                 flatGrid[x][z] = roadType;
             }
             workerRef.current?.postMessage({ type: 'SYNC_ROADS', payload: flatGrid });
         }
     };
     window.addEventListener('onRoadPlaced', handleRoadPlaced);

     // Road session cancel — undo all roads placed this session
     const handleRoadSessionCancel = (e: any) => {
       const roads: { x: number; z: number }[] = e.detail;
       const { removeRoad, roads: currentRoads } = useParkState.getState();
       const { addMoney } = useGameState.getState();
       const roadSet = new Set(roads.map(r => `${r.x},${r.z}`));
       // Remove each road tile and refund
       for (const r of roads) {
         const existing = currentRoads.find(road => road.x === r.x && road.z === r.z);
         if (existing) {
           const refund = existing.type === 'normal' ? 5 : existing.type === 'wide' ? 9 : 3;
           // Remove from store
         }
       }
       // Batch remove via zustand
       useParkState.setState(state => ({
         roads: state.roads.filter(r => !roadSet.has(`${r.x},${r.z}`))
       }));
       // Refund
       const totalRefund = roads.length * 5; // Approximate — use actual costs
       addMoney(Math.floor(totalRefund * 0.7));
       // Sync road grid to worker
       const remainingRoads = useParkState.getState().roads;
       const gridSize = useGameState.getState().gridSize;
       const flatGrid: (string | null)[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
       for (const r of remainingRoads) {
         if (r.x >= 0 && r.z >= 0 && r.x < gridSize && r.z < gridSize) {
           flatGrid[r.x][r.z] = r.type;
         }
       }
       workerRef.current?.postMessage({ type: 'SYNC_ROADS', payload: flatGrid });
     };
     window.addEventListener('onRoadSessionCancel', handleRoadSessionCancel);

     const handleStaffSpawn = (e: any) => {
         if (workerRef.current) {
             workerRef.current.postMessage({ type: 'SPAWN_STAFF', payload: e.detail });
         }
     }
     window.addEventListener('onStaffSpawn', handleStaffSpawn);

     const handleCoasterBuilt = (e: any) => {
         const { typeId, pieces } = e.detail;
         const { addFacility } = useParkState.getState();
         const instanceId = `coaster_${Date.now()}`;
         const x = pieces.length > 0 ? pieces[0].x : 0;
         const z = pieces.length > 0 ? pieces[0].z : 0;
         const rotation = 0;
         const trackPieces = pieces;
         const facilityRecord: PlacedFacility = {
           instanceId, typeId, x, z, rotation,
           age: 0, breakdown: false, trackPieces,
           totalRides: 0, ticketPrice: 0, lastRepairDay: 0, builtOnDay: 0,
           durability: 100
         };
         addFacility(facilityRecord);
     }
     window.addEventListener('onCoasterBuilt', handleCoasterBuilt);

     const handleGameLoaded = (e: any) => {
         const data = e.detail;
         
         // Hydrate useGameState
         useGameState.setState({
            parkName: data.park.name || '我的海岸公园',
            money: data.park.money,
            day: data.park.date.day,
            month: data.park.date.month,
            rating: data.park.rating,
            stars: data.park.stars,
            ticketMode: data.park.settings.ticketMode,
            ticketPrice: data.park.settings.ticketPrice,
            speed: data.park.settings.speedMultiplier,
            loan: data.economy.loan,
            historicalData: data.economy.historicalData,
            monthlyResearchBudget: data.research.monthlyBudget,
            researchPoints: data.research.accumulatedPoints,
            unlockedTechs: data.research.unlocked,
            weather: data.weather,
            nextWeather: data.nextWeather
         });

         // Hydrate useParkState
         useParkState.setState({
            roads: data.roads,
            facilities: data.facilities,
            visitors: data.visitors.reduce((acc: any, v: any) => ({ ...acc, [v.id]: v }), {}),
            staff: data.staff.reduce((acc: any, s: any) => ({ ...acc, [s.id]: s }), {})
         });

         // Send strict LOAD_STATE event to Web Worker
         if (workerRef.current) {
             workerRef.current.postMessage({ type: 'LOAD_STATE', payload: data });
         }
     };
     window.addEventListener('onGameLoaded', handleGameLoaded);

     // Facility demolish handler — dispatch to worker for refund
     const handleDemolish = (e: any) => {
         if (workerRef.current) {
             workerRef.current.postMessage({ type: 'REMOVE_FACILITY', payload: e.detail });
         }
         window.dispatchEvent(new CustomEvent('onPlayDemolishSound'));
     };
     window.addEventListener('onFacilityDemolish', handleDemolish);

     // Message click → pan camera to target position
     const handleMessageClick = (e: any) => {
         const { targetPos } = e.detail;
         if (targetPos) {
             window.dispatchEvent(new CustomEvent('onCameraPan', { detail: targetPos }));
         }
     };
     window.addEventListener('onMessageClick', handleMessageClick);

     return () => {
         window.removeEventListener('onFacilityUpdate', handleUpdate);
         window.removeEventListener('onRoadPlaced', handleRoadPlaced);
         window.removeEventListener('onRoadSessionCancel', handleRoadSessionCancel);
         window.removeEventListener('onStaffSpawn', handleStaffSpawn);
         window.removeEventListener('onCoasterBuilt', handleCoasterBuilt);
         window.removeEventListener('onGameLoaded', handleGameLoaded);
         window.removeEventListener('onFacilityDemolish', handleDemolish);
         window.removeEventListener('onMessageClick', handleMessageClick);
     };
  }, []);

  // Sync state to worker when paused/speed changes
  useEffect(() => {
    if (workerRef.current) {
      if (gamePaused) {
        workerRef.current.postMessage({ type: 'STOP' });
      } else {
        workerRef.current.postMessage({ type: 'SET_SPEED', payload: { speed } });
      }
    }
    // Sync speed to SceneManager for day/night cycle
    window.dispatchEvent(new CustomEvent('onSpeedChange', { detail: gamePaused ? 0 : speed }));
  }, [speed, gamePaused]);

  // Sync facilities to worker
  useEffect(() => {
     if (workerRef.current) {
         workerRef.current.postMessage({ type: 'SYNC_FACILITIES', payload: facilities });
     }
  }, [facilities]);

  const ticketMode = useGameState(state => state.ticketMode);
  const ticketPrice = useGameState(state => state.ticketPrice);
  const day = useGameState(state => state.day);
  const month = useGameState(state => state.month);
  const unlockedTechs = useGameState(state => state.unlockedTechs);
  const stars = useGameState(state => state.stars);

  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'SYNC_SETTINGS',
        payload: { ticketMode, ticketPrice, day, month, unlockedTechs, stars }
      });
    }
  }, [ticketMode, ticketPrice, day, month, unlockedTechs, stars]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <BabylonCanvas />
      
      {/* Top HUD */}
      <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
        <HUD />
      </div>

      {/* Bottom Build Bar */}
      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'center' }}>
        {useParkState(s => s.coasterBuilderMode) ? <CoasterEditor /> : <BuildBar />}
      </div>

      {/* Message feed (bottom left) */}
      <div style={{ position: 'absolute', bottom: 100, left: 20, zIndex: 10 }}>
        <MessageFeed />
      </div>

      {/* Mini map (bottom right) */}
      <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 10 }}>
        <MiniMap />
      </div>

      {/* Info cards */}
      {selectedFacilityId && <FacilityInfoCard />}
      {selectedVisitorId && <VisitorInfoCard />}

      {/* Title screen */}
      {showTitle && <TitleScreen onStart={() => {
        try { localStorage.setItem('coast_returning', 'true'); } catch {}
        setShowTitle(false);
      }} />}

      {/* Tutorial overlay */}
      {!showTitle && showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}

      {/* Auto-save indicator */}
      {isSaving && (
        <div style={{
          position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, background: 'rgba(244, 162, 35, 0.9)', padding: '6px 16px',
          borderRadius: 6, fontSize: 13, fontWeight: 500, color: '#fff',
          animation: 'fadeInOut 1.5s ease-in-out'
        }}>
          💾 保存中...
        </div>
      )}

      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default App;
