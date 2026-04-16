export type Position = {
  x: number;
  z: number;
};

export type FacilityType =
  | 'coaster_basic'
  | 'pirate_ship'
  | 'merry_go_round'
  | 'ferris_wheel'
  | 'burger_stall'
  | 'drink_stall'
  | 'restroom'
  | 'bench'
  | 'trash_can'
  | 'drop_tower'
  | 'bumper_cars'
  | 'dark_ride'
  | 'launch_coaster';

export type Category = 'thrill' | 'gentle' | 'shop' | 'facility' | 'scenery';

export interface FacilityDef {
  id: FacilityType;
  name: string;
  category: Category;
  sizeX: number;
  sizeZ: number;
  buildCost: number;
  monthlyUpkeep: number;
  excitement?: number;
  nausea?: number;
  appeal?: number;
}

export interface PlacedFacility {
  instanceId: string;
  typeId: FacilityType;
  x: number;
  z: number;
  rotation: number;
  age: number;
  breakdown: boolean; // Phase 2: Facility breakdown
  trackPieces?: CoasterTrackPiece[]; // Phase 3: Coaster tracks
}

// Phase 2 Types below

export type VisitorState = 'idle' | 'walking' | 'queuing' | 'riding' | 'leaving';
export type WeatherType = 'sunny' | 'cloudy' | 'rain';

export interface VisitorNeeds {
  hunger: number;
  thirst: number;
  toilet: number;
  fatigue: number;
  nausea: number;
  fun: number;
}

export interface Visitor {
  id: string;
  pos: Position;
  targetPos: Position | null;
  targetFacilityId: string | null;
  state: VisitorState;
  needs: VisitorNeeds;
  money: number;
}

export type StaffType = 'cleaner' | 'mechanic' | 'security' | 'entertainer';

export interface Staff {
  id: string;
  type: StaffType;
  pos: Position;
  targetPos: Position | null;
  targetInstanceId: string | null;
}

export interface VomitPoint {
  id: string;
  pos: Position;
}

export interface MonthData {
  monthIndex: number;
  revenue: number;
  expenses: number;
}

// Phase 3 Types below

export type TrackPieceType = 'straight' | 'climb' | 'dive' | 'loop';

export interface CoasterTrackPiece {
  x: number;
  z: number;
  type: TrackPieceType;
  rotation: number;
}

export interface TechNode {
  id: string;
  name: string;
  cost: number;
  unlocked: boolean;
  facilityIds: FacilityType[];
  dependsOn?: string;
}
