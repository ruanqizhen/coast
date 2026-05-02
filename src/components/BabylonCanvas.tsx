import { useEffect, useRef } from 'react';
import { SceneManager } from '../engine/SceneManager';
import { Tools } from '@babylonjs/core/Misc/tools.js';
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
      const { id, x, z, rotation = 0 } = customEvent.detail;
      
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
          builtOnDay: 0,
          durability: 100
        };
        addFacility(facilityRecord);
        exitPlacementMode();
        window.dispatchEvent(new CustomEvent('onPlayPlaceSound'));
      } else {
        window.dispatchEvent(new CustomEvent('onPlayErrorSound'));
      }
    };

    const handleScreenshot = () => {
       if (managerRef.current && canvasRef.current) {
          Tools.CreateScreenshot(managerRef.current.scene.getEngine(), managerRef.current.camera, { precision: 2 });
       }
    };

    // Wire audio to global events
    const handlePlayUIClick = () => managerRef.current?.soundManager.playUIClick();
    const handlePlayPlace = () => managerRef.current?.soundManager.playPlace();
    const handlePlayDemolish = () => managerRef.current?.soundManager.playDemolish();
    const handlePlayError = () => managerRef.current?.soundManager.playError();
    const handleBreakdownAlarm = () => managerRef.current?.soundManager.playBreakdownAlarm();
    const handleRainStart = (e: Event) => managerRef.current?.soundManager.startRainSound((e as CustomEvent).detail?.heavy);
    const handleRainStop = () => managerRef.current?.soundManager.stopRainSound();
    const handleBGMStart = () => managerRef.current?.soundManager.startBGM();
    const handleBGMStop = () => managerRef.current?.soundManager.stopBGM();
    const handleSetAudioEnabled = (e: Event) => managerRef.current?.soundManager.setEnabled((e as CustomEvent).detail);

    window.addEventListener('onFacilityPlaced', handlePlacement);
    window.addEventListener('onTakeScreenshot', handleScreenshot);
    window.addEventListener('onPlayUIClick', handlePlayUIClick);
    window.addEventListener('onPlayPlaceSound', handlePlayPlace);
    window.addEventListener('onPlayDemolishSound', handlePlayDemolish);
    window.addEventListener('onPlayErrorSound', handlePlayError);
    window.addEventListener('onBreakdownAlarm', handleBreakdownAlarm);
    window.addEventListener('onRainStart', handleRainStart);
    window.addEventListener('onRainStop', handleRainStop);
    window.addEventListener('onBGMStart', handleBGMStart);
    window.addEventListener('onBGMStop', handleBGMStop);
    const handleSetSFXVolume = (e: Event) => managerRef.current?.soundManager.setSFXVolume((e as CustomEvent).detail);
    const handleSetBGMVolume = (e: Event) => managerRef.current?.soundManager.setBGMVolume((e as CustomEvent).detail);
    window.addEventListener('onSetAudioEnabled', handleSetAudioEnabled);
    window.addEventListener('onSetSFXVolume', handleSetSFXVolume);
    window.addEventListener('onSetBGMVolume', handleSetBGMVolume);

    return () => {
      window.removeEventListener('onFacilityPlaced', handlePlacement);
      window.removeEventListener('onTakeScreenshot', handleScreenshot);
      window.removeEventListener('onPlayUIClick', handlePlayUIClick);
      window.removeEventListener('onPlayPlaceSound', handlePlayPlace);
      window.removeEventListener('onPlayDemolishSound', handlePlayDemolish);
      window.removeEventListener('onPlayErrorSound', handlePlayError);
      window.removeEventListener('onBreakdownAlarm', handleBreakdownAlarm);
      window.removeEventListener('onRainStart', handleRainStart);
      window.removeEventListener('onRainStop', handleRainStop);
      window.removeEventListener('onBGMStart', handleBGMStart);
      window.removeEventListener('onBGMStop', handleBGMStop);
      window.removeEventListener('onSetAudioEnabled', handleSetAudioEnabled);
      window.removeEventListener('onSetSFXVolume', handleSetSFXVolume);
      window.removeEventListener('onSetBGMVolume', handleSetBGMVolume);
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
