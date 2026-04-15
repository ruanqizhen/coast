import { create } from 'zustand';
import type { PlacedFacility, FacilityType, Visitor, Staff, VomitPoint } from '../types';

interface ParkState {
  facilities: PlacedFacility[];
  visitors: Record<string, Visitor>;
  staff: Record<string, Staff>;
  vomitPoints: Record<string, VomitPoint>;
  
  // Placement State
  placementMode: boolean;
  selectedFacilityToPlace: FacilityType | 'cleaner' | 'mechanic' | null;
  
  // Actions
  addFacility: (facility: PlacedFacility) => void;
  removeFacility: (instanceId: string) => void;
  
  enterPlacementMode: (type: FacilityType | 'cleaner' | 'mechanic') => void;
  exitPlacementMode: () => void;
  
  // Simulation Mutations
  setFacilities: (facilities: PlacedFacility[]) => void;
  setVisitors: (visitors: Record<string, Visitor>) => void;
  setStaff: (staff: Record<string, Staff>) => void;
  setVomitPoints: (vomit: Record<string, VomitPoint>) => void;
}

export const useParkState = create<ParkState>((set) => ({
  facilities: [],
  visitors: {},
  staff: {},
  vomitPoints: {},
  
  placementMode: false,
  selectedFacilityToPlace: null,

  addFacility: (facility) => set((state) => ({ facilities: [...state.facilities, facility] })),
  removeFacility: (instanceId) => set((state) => ({ 
    facilities: state.facilities.filter(f => f.instanceId !== instanceId) 
  })),
  
  enterPlacementMode: (type) => set({ placementMode: true, selectedFacilityToPlace: type }),
  exitPlacementMode: () => set({ placementMode: false, selectedFacilityToPlace: null }),
  
  setFacilities: (facilities) => set({ facilities }),
  setVisitors: (visitors) => set({ visitors }),
  setStaff: (staff) => set({ staff }),
  setVomitPoints: (vomitPoints) => set({ vomitPoints }),
}));
