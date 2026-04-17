import { create } from 'zustand';
import type {
  PlacedFacility, FacilityType, Visitor, Staff, VomitPoint,
  CoasterTrackPiece, StaffType, RoadTile, RoadType, TrashPoint
} from '../types';

interface ParkState {
  facilities: PlacedFacility[];
  visitors: Record<string, Visitor>;
  staff: Record<string, Staff>;
  vomitPoints: Record<string, VomitPoint>;
  trashPoints: Record<string, TrashPoint>;
  roads: RoadTile[];

  // Placement State
  placementMode: boolean;
  selectedFacilityToPlace: FacilityType | StaffType | RoadType | null;
  placementCategory: 'facility' | 'staff' | 'road' | null;
  placementRotation: number; // 0, 90, 180, 270
  coasterBuilderMode: boolean;
  currentCoasterPieces: CoasterTrackPiece[];

  // Info Card State
  selectedFacilityId: string | null;
  selectedVisitorId: string | null;

  // Actions
  addFacility: (facility: PlacedFacility) => void;
  removeFacility: (instanceId: string) => void;
  updateFacility: (instanceId: string, updates: Partial<PlacedFacility>) => void;

  enterPlacementMode: (type: FacilityType | StaffType | RoadType, category: 'facility' | 'staff' | 'road') => void;
  exitPlacementMode: () => void;
  rotatePlacement: () => void;
  toggleCoasterBuilder: (active: boolean) => void;
  addCoasterPiece: (piece: CoasterTrackPiece) => void;
  clearCoasterPieces: () => void;

  // Selection
  selectFacility: (id: string | null) => void;
  selectVisitor: (id: string | null) => void;

  // Road actions
  addRoad: (road: RoadTile) => void;
  removeRoad: (x: number, z: number) => void;
  setRoads: (roads: RoadTile[]) => void;

  // Simulation mutations
  setFacilities: (facilities: PlacedFacility[]) => void;
  setVisitors: (visitors: Record<string, Visitor>) => void;
  setStaff: (staff: Record<string, Staff>) => void;
  setVomitPoints: (vomit: Record<string, VomitPoint>) => void;
  setTrashPoints: (trash: Record<string, TrashPoint>) => void;
}

export const useParkState = create<ParkState>((set) => ({
  facilities: [],
  visitors: {},
  staff: {},
  vomitPoints: {},
  trashPoints: {},
  roads: [],

  placementMode: false,
  selectedFacilityToPlace: null,
  placementCategory: null,
  placementRotation: 0,
  coasterBuilderMode: false,
  currentCoasterPieces: [],

  selectedFacilityId: null,
  selectedVisitorId: null,

  addFacility: (facility) => set((state) => ({ facilities: [...state.facilities, facility] })),
  removeFacility: (instanceId) => set((state) => ({
    facilities: state.facilities.filter(f => f.instanceId !== instanceId),
  })),
  updateFacility: (instanceId, updates) => set((state) => ({
    facilities: state.facilities.map(f =>
      f.instanceId === instanceId ? { ...f, ...updates } : f
    ),
  })),

  enterPlacementMode: (type, category) => set({
    placementMode: true,
    selectedFacilityToPlace: type,
    placementCategory: category,
  }),
  exitPlacementMode: () => set({
    placementMode: false,
    selectedFacilityToPlace: null,
    placementCategory: null,
    placementRotation: 0,
    coasterBuilderMode: false,
  }),
  rotatePlacement: () => set((state) => ({
    placementRotation: (state.placementRotation + 90) % 360,
  })),

  toggleCoasterBuilder: (active) => set({ coasterBuilderMode: active }),
  addCoasterPiece: (piece) => set((state) => ({
    currentCoasterPieces: [...state.currentCoasterPieces, piece],
  })),
  clearCoasterPieces: () => set({ currentCoasterPieces: [] }),

  selectFacility: (id) => set({ selectedFacilityId: id, selectedVisitorId: null }),
  selectVisitor: (id) => set({ selectedVisitorId: id, selectedFacilityId: null }),

  addRoad: (road) => set((state) => ({ roads: [...state.roads, road] })),
  removeRoad: (x, z) => set((state) => ({
    roads: state.roads.filter(r => !(r.x === x && r.z === z)),
  })),
  setRoads: (roads) => set({ roads }),

  setFacilities: (facilities) => set({ facilities }),
  setVisitors: (visitors) => set({ visitors }),
  setStaff: (staff) => set({ staff }),
  setVomitPoints: (vomitPoints) => set({ vomitPoints }),
  setTrashPoints: (trashPoints) => set({ trashPoints }),
}));
