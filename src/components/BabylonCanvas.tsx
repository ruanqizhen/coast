import { useEffect, useRef } from 'react';
import { SceneManager } from '../engine/SceneManager';
import { Tools } from '@babylonjs/core';
import { useGameState } from '../store/useGameState';
import { useParkState } from '../store/useParkState';
import { FACILITIES } from '../config/facilities';
import type { FacilityType, PlacedFacility } from '../types';

export function BabylonCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<SceneManager | null>(null);

  useEffect(() => {
    if (canvasRef.current && !managerRef.current) {
      managerRef.current = new SceneManager(canvasRef.current);
    }

    const handlePlacement = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: FacilityType | 'cleaner' | 'mechanic' | 'security' | 'entertainer'; x: number; z: number; rotation: number }>;
      const { id, x, z, rotation } = customEvent.detail;
      
      const { deductMoney } = useGameState.getState();
      const { addFacility, exitPlacementMode } = useParkState.getState();

      if (id === 'cleaner' || id === 'mechanic' || id === 'security' || id === 'entertainer') {
         const cost = id === 'cleaner' ? 100 : id === 'mechanic' ? 150 : id === 'security' ? 120 : 80;
         if (deductMoney(cost)) {
             window.dispatchEvent(new CustomEvent('onStaffSpawn', { detail: { type: id, x, z } }));
             exitPlacementMode();
         }
         return;
      }

      const def = FACILITIES[id as FacilityType];
      if (!def) return;

      if (deductMoney(def.buildCost)) {
        const facilityRecord: PlacedFacility = {
          instanceId: `fac_${Date.now()}`,
          typeId: id as FacilityType,
          x,
          z,
          rotation,
          age: 0,
          breakdown: false,
          totalRides: 0,
          ticketPrice: 0,
          lastRepairDay: 0,
          builtOnDay: 0
        };
        addFacility(facilityRecord);
        exitPlacementMode();
      }
    };

    const handleScreenshot = () => {
       if (managerRef.current && canvasRef.current) {
          Tools.CreateScreenshot(managerRef.current.scene.getEngine(), managerRef.current.camera, { precision: 2 });
       }
    };

    window.addEventListener('onFacilityPlaced', handlePlacement);
    window.addEventListener('onTakeScreenshot', handleScreenshot);

    return () => {
      window.removeEventListener('onFacilityPlaced', handlePlacement);
      window.removeEventListener('onTakeScreenshot', handleScreenshot);
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
