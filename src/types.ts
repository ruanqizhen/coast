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
  | 'trash_can';

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

export type StaffType = 'cleaner' | 'mechanic';

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
  satisfaction: number;
}
