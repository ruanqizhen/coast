import React, { useEffect, useRef } from 'react';
import { HUD } from './components/HUD';
import { BuildBar } from './components/BuildBar';
import { BabylonCanvas } from './components/BabylonCanvas';
import { useGameState } from './store/useGameState';

export function App() {
  const workerRef = useRef<Worker | null>(null);
  const advanceDay = useGameState(state => state.advanceDay);
  const speed = useGameState(state => state.speed);
  const paused = useGameState(state => state.gamePaused);

  useEffect(() => {
    // Initialize Web Worker
    workerRef.current = new Worker(new URL('./workers/simulation.worker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'TICK') {
        advanceDay();
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (workerRef.current) {
      if (paused) {
        workerRef.current.postMessage({ type: 'STOP' });
      } else {
        workerRef.current.postMessage({ type: 'SET_SPEED', payload: { speed } });
      }
    }
  }, [speed, paused]);

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
