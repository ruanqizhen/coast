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
}
