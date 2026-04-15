import React, { useEffect, useRef } from 'react';
import { HUD } from './components/HUD';
import { BuildBar } from './components/BuildBar';
import { BabylonCanvas } from './components/BabylonCanvas';
import { useGameState } from './store/useGameState';
import { useParkState } from './store/useParkState';

export function App() {
  const workerRef = useRef<Worker | null>(null);
  
  const { advanceDay, speed, gamePaused, addMoney, setWeather, setRating, setVisitorsCount } = useGameState();
  const { facilities, setFacilities, setVisitors, setStaff, setVomitPoints } = useParkState();

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
        setWeather(payload);
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

     const handleStaffSpawn = (e: any) => {
         if (workerRef.current) {
             workerRef.current.postMessage({ type: 'SPAWN_STAFF', payload: e.detail });
         }
     }
     window.addEventListener('onStaffSpawn', handleStaffSpawn);

     return () => {
         window.removeEventListener('onFacilityUpdate', handleUpdate);
         window.removeEventListener('onStaffSpawn', handleStaffSpawn);
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

  const paused = useGameState(state => state.gamePaused);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <BabylonCanvas />
      
      <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
        <HUD />
      </div>

      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'center' }}>
        <BuildBar />
      </div>
    </div>
  );
}

export default App;
