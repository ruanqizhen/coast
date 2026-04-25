import { useEffect, useRef, useCallback } from 'react';
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
import { saveManager } from './engine/SaveSystem';
import { CONSTANTS } from './config/constants';
import type { PlacedFacility, SaveData } from './types';

export function App() {
  const workerRef = useRef<Worker | null>(null);
  
  const advanceDay = useGameState(state => state.advanceDay);
  const speed = useGameState(state => state.speed);
  const gamePaused = useGameState(state => state.gamePaused);
  const addMoney = useGameState(state => state.addMoney);
  const setWeather = useGameState(state => state.setWeather);
  const setRating = useGameState(state => state.setRating);
  const setVisitorsCount = useGameState(state => state.setVisitorsCount);

  const facilities = useParkState(state => state.facilities);
  const setVisitors = useParkState(state => state.setVisitors);
  const setStaff = useParkState(state => state.setStaff);
  const setVomitPoints = useParkState(state => state.setVomitPoints);
  const selectedFacilityId = useParkState(state => state.selectedFacilityId);
  const selectedVisitorId = useParkState(state => state.selectedVisitorId);
  const isSaving = useGameState(state => state.isSaving);

  // ═══════════════════════════════════
  // Auto-save every 5 minutes (PRD §8.6)
  // ═══════════════════════════════════
  const doAutoSave = useCallback(async () => {
    const gState = useGameState.getState();
    const pState = useParkState.getState();

    const data: SaveData = {
      version: "1.0.0",
      park: {
        name: "My Coast Park",
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
      
      if (type === 'DAY_TICK') {
        advanceDay();
      } else if (type === 'SIM_UPDATE') {
        setVisitors(payload.visitors);
        setStaff(payload.staff);
        setVomitPoints(payload.vomitPoints);
        setVisitorsCount(Object.keys(payload.visitors).length);
      } else if (type === 'WEATHER_UPDATE') {
        setWeather(payload.current, payload.next);
      } else if (type === 'RATING_UPDATE') {
        setRating(payload);
      } else if (type === 'ECONOMY_UPDATE') {
        if (payload.type === 'SPEND') {
          addMoney(payload.amount);
        }
      } else if (type === 'FACILITY_BREAKDOWN') {
         window.dispatchEvent(new CustomEvent('onFacilityUpdate', { detail: { id: payload, breakdown: true }}));
      } else if (type === 'FACILITY_FIXED') {
         window.dispatchEvent(new CustomEvent('onFacilityUpdate', { detail: { id: payload, breakdown: false }}));
      } else if (type === 'MESSAGE') {
         useGameState.getState().addMessage(payload);
      } else if (type === 'STAR_UPDATE') {
         useGameState.getState().setStars(payload);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []); // Note: we omit advanceDay from deps to prevent recreating worker

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
           totalRides: 0, ticketPrice: 0, lastRepairDay: 0, builtOnDay: 0
         };
         addFacility(facilityRecord);
     }
     window.addEventListener('onCoasterBuilt', handleCoasterBuilt);

     const handleGameLoaded = (e: any) => {
         const data = e.detail;
         
         // Hydrate useGameState
         useGameState.setState({
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
