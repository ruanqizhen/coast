import { create } from 'zustand';
import type { PlacedFacility, FacilityType, FacilityDef } from '../types';

interface ParkState {
  facilities: PlacedFacility[];
  
  // Placement State
  placementMode: boolean;
  selectedFacilityToPlace: FacilityType | null;
  
  // Actions
  addFacility: (facility: PlacedFacility) => void;
  removeFacility: (instanceId: string) => void;
  enterPlacementMode: (type: FacilityType) => void;
  exitPlacementMode: () => void;
}

export const useParkState = create<ParkState>((set) => ({
  facilities: [],
  placementMode: false,
  selectedFacilityToPlace: null,

  addFacility: (facility) => set((state) => ({ facilities: [...state.facilities, facility] })),
  removeFacility: (instanceId) => set((state) => ({ 
    facilities: state.facilities.filter(f => f.instanceId !== instanceId) 
  })),
  enterPlacementMode: (type) => set({ placementMode: true, selectedFacilityToPlace: type }),
  exitPlacementMode: () => set({ placementMode: false, selectedFacilityToPlace: null }),
}));
