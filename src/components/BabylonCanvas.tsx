import React, { useEffect, useRef } from 'react';
import { SceneManager } from '../engine/SceneManager';
import { useGameState } from '../store/useGameState';
import { useParkState } from '../store/useParkState';
import { FACILITIES } from '../config/facilities';
import type { FacilityType, Category } from '../types';

export function BabylonCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<SceneManager | null>(null);

  useEffect(() => {
    if (canvasRef.current && !managerRef.current) {
      managerRef.current = new SceneManager(canvasRef.current);
    }

    const handlePlacement = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: FacilityType | 'cleaner' | 'mechanic'; x: number; z: number }>;
      const { id, x, z } = customEvent.detail;
      
      const { deductMoney } = useGameState.getState();
      const { addFacility, exitPlacementMode } = useParkState.getState();

      if (id === 'cleaner' || id === 'mechanic') {
         const cost = id === 'cleaner' ? 100 : 150;
         if (deductMoney(cost)) {
             window.dispatchEvent(new CustomEvent('onStaffSpawn', { detail: { type: id, x, z } }));
             exitPlacementMode();
         }
         return;
      }

      const def = FACILITIES[id as FacilityType];
      if (!def) return;

      if (deductMoney(def.buildCost)) {
        addFacility({
          instanceId: `fac_${Date.now()}`,
          typeId: id as FacilityType,
          x,
          z,
          rotation: 0,
          age: 0,
          breakdown: false
        });
        exitPlacementMode();
      }
    };

    window.addEventListener('onFacilityPlaced', handlePlacement);

    return () => {
      window.removeEventListener('onFacilityPlaced', handlePlacement);
      managerRef.current?.dispose();
      managerRef.current = null;
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      style={{
        width: '100%',
        height: '100%',
        touchAction: 'none',
        outline: 'none'
      }} 
    />
  );
}
