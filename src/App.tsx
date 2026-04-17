import React, { useEffect, useRef } from 'react';
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
  const setFacilities = useParkState(state => state.setFacilities);
  const setVisitors = useParkState(state => state.setVisitors);
  const setStaff = useParkState(state => state.setStaff);
  const setVomitPoints = useParkState(state => state.setVomitPoints);
  const selectedFacilityId = useParkState(state => state.selectedFacilityId);
  const selectedVisitorId = useParkState(state => state.selectedVisitorId);

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
         // Zustand state setter outside component requires get/set, but we can do a simple hack for now
         // Since we don't have a direct reducer, we dispatch an event
         window.dispatchEvent(new CustomEvent('onFacilityUpdate', { detail: { id: payload, breakdown: true }}));
      } else if (type === 'FACILITY_FIXED') {
         window.dispatchEvent(new CustomEvent('onFacilityUpdate', { detail: { id: payload, breakdown: false }}));
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
         // Usually we'd check if first piece == last piece position, for now just spawn
         useParkState.getState().addFacility({
             instanceId: `coaster_${Date.now()}`,
             typeId,
             x: pieces.length > 0 ? pieces[0].x : 0,
             z: pieces.length > 0 ? pieces[0].z : 0,
             rotation: 0,
             age: 0,
             breakdown: false,
             trackPieces: pieces
         });
     }
     window.addEventListener('onCoasterBuilt', handleCoasterBuilt);

     return () => {
         window.removeEventListener('onFacilityUpdate', handleUpdate);
         window.removeEventListener('onRoadPlaced', handleRoadPlaced);
         window.removeEventListener('onStaffSpawn', handleStaffSpawn);
         window.removeEventListener('onCoasterBuilt', handleCoasterBuilt);
     };
  }, []);

  // Sync state to worker when paused/speed changes
  useEffect(() => {
    if (workerRef.current) {
      if (paused) {
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

  const paused = useGameState(state => state.gamePaused);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <BabylonCanvas />
      
      <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
        <HUD />
      </div>

      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'center' }}>
        {useParkState(s => s.coasterBuilderMode) ? <CoasterEditor /> : <BuildBar />}
        {/* Message feed (bottom left) */}
        <div style={{ position: 'absolute', bottom: 80, left: 20, zIndex: 10 }}>
          <MessageFeed />
        </div>
        {/* Mini map (bottom right) */}
        <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 10 }}>
          <MiniMap />
        </div>
        {/* Info cards */}
        {selectedFacilityId && <FacilityInfoCard />}
        {selectedVisitorId && <VisitorInfoCard />}
      </div>
    </div>
  );
}

export default App;
