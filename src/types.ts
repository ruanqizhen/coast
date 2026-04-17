// ──────────────────────────────────
// Position & Grid
// ──────────────────────────────────
export type Position = {
  x: number;
  z: number;
};

// ──────────────────────────────────
// Road System
// ──────────────────────────────────
export type RoadType = 'normal' | 'wide' | 'staff';

export interface RoadTile {
  x: number;
  z: number;
  type: RoadType;
}

// ──────────────────────────────────
// Facilities
// ──────────────────────────────────
export type FacilityType =
  | 'coaster_basic'
  | 'pirate_ship'
  | 'merry_go_round'
  | 'ferris_wheel'
  | 'burger_stall'
  | 'drink_stall'
  | 'restaurant'
  | 'restroom'
  | 'bench'
  | 'trash_can'
  | 'first_aid'
  | 'drop_tower'
  | 'bumper_cars'
  | 'dark_ride'
  | 'launch_coaster'
  | 'flower_bed'
  | 'fountain'
  | 'weather_tent';

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
  capacity?: number;        // Max guests per batch / queue
  rideDuration?: number;    // ms per ride cycle
  costRate?: number;        // For shops: cost as % of price (e.g. 0.3)
  envRadius?: number;       // Scenery: radius of environment score boost
  envBoost?: number;        // Scenery: environment score boost value
  requiresTech?: string;    // Tech tree node ID required to unlock
  requiresStars?: number;   // Star rating required
  isOutdoor?: boolean;      // Affected by heavy rain
}

export interface PlacedFacility {
  instanceId: string;
  typeId: FacilityType;
  x: number;
  z: number;
  rotation: number;         // 0, 90, 180, 270
  age: number;              // In game days
  breakdown: boolean;
  totalRides: number;       // Lifetime ride count
  ticketPrice: number;      // Player-set price for this facility
  lastRepairDay: number;    // Day of last repair
  builtOnDay: number;       // Day facility was built (for refund calc)
  trackPieces?: CoasterTrackPiece[];
}

// ──────────────────────────────────
// Visitor AI
// ──────────────────────────────────
export type VisitorAgeGroup = 'child' | 'teen' | 'adult' | 'family';

export type VisitorState =
  | 'entering'
  | 'idle'
  | 'walking'
  | 'queuing'
  | 'riding'
  | 'eating'
  | 'resting'
  | 'vomiting'
  | 'first_aid'
  | 'leaving';

export interface VisitorNeeds {
  hunger: number;     // 0–100, higher = more hungry
  thirst: number;     // 0–100
  toilet: number;     // 0–100, higher = more urgent
  fatigue: number;    // 0–100, higher = more tired
  nausea: number;     // 0–100
  fun: number;        // 0–100, higher = having more fun
}

export interface Visitor {
  id: string;
  pos: Position;
  targetPos: Position | null;
  targetFacilityId: string | null;
  state: VisitorState;
  needs: VisitorNeeds;
  money: number;
  satisfaction: number;       // 0–100 individual satisfaction
  // Individual attributes (generated on entry)
  ageGroup: VisitorAgeGroup;
  excitementPref: number;     // 1–10
  nauseaTolerance: number;    // 1–10
  patience: number;           // 60–120 seconds
  spendingWillingness: number;// 0.5–1.5 multiplier
  // Tracking
  path: Position[];           // A* computed path
  pathIndex: number;          // Current step in path
  queueStartTime: number;    // Timestamp when started queuing
  lastHighNauseaRide: boolean;// Did they just ride a high-nausea ride?
  ridesCount: number;         // Total rides taken this visit
  enteredOnDay: number;       // Day they entered the park
}

// ──────────────────────────────────
// Staff
// ──────────────────────────────────
export type StaffType = 'cleaner' | 'mechanic' | 'security' | 'entertainer';

export interface StaffPatrolZone {
  x: number;
  z: number;
  w: number; // width in grid cells (default 8)
  h: number; // height in grid cells (default 8)
}

export interface Staff {
  id: string;
  type: StaffType;
  pos: Position;
  targetPos: Position | null;
  targetInstanceId: string | null;
  patrolZone: StaffPatrolZone;
  // Entertainer specific
  energy: number;            // 0–100, entertainer stamina
  restingUntil: number;      // Timestamp when rest ends
  // Mechanic specific
  lastInspectionTime: number;// Last time inspected facilities
}

export interface VomitPoint {
  id: string;
  pos: Position;
}

export interface TrashPoint {
  id: string;
  pos: Position;
  amount: number; // 0–50
}

// ──────────────────────────────────
// Weather
// ──────────────────────────────────
export type WeatherType = 'sunny' | 'cloudy' | 'light_rain' | 'heavy_rain' | 'holiday';

// ──────────────────────────────────
// Economy & Finance
// ──────────────────────────────────
export type TicketMode = 'free' | 'paid';

export interface LoanState {
  principal: number;     // Current loan amount
  monthlyRate: number;   // 0.015 = 1.5%
  maxLoan: number;       // $5,000
}

export interface MonthData {
  monthIndex: number;
  revenue: number;
  expenses: number;
  satisfaction: number;
  visitorPeak: number;
  visitorTotal: number;
}

// ──────────────────────────────────
// Star Rating
// ──────────────────────────────────
export interface StarRequirement {
  stars: number;          // 1–5
  satisfactionMin: number;
  visitorMin: number;
  unlockDescription: string;
}

// ──────────────────────────────────
// Messages / Notifications
// ──────────────────────────────────
export type MessagePriority = 'critical' | 'warning' | 'milestone' | 'info';

export interface GameMessage {
  id: string;
  text: string;
  priority: MessagePriority;
  timestamp: number;
  targetId?: string;       // Facility or visitor ID to focus on
  targetPos?: Position;    // Position to pan camera to
}

// ──────────────────────────────────
// Coaster Track (Phase 3)
// ──────────────────────────────────
export type TrackPieceType = 'straight' | 'climb' | 'dive' | 'loop' | 'super_loop';

export interface CoasterTrackPiece {
  x: number;
  z: number;
  type: TrackPieceType;
  rotation: number;
  slopeAngle?: number;     // Manual slope adjustment, step 5°
}

// Track piece stat bonuses (from PRD)
export const TRACK_PIECE_STATS: Record<TrackPieceType, { excitement: number; nausea: number; breakdownBonus: number }> = {
  straight:   { excitement: 0,   nausea: 0,   breakdownBonus: 0 },
  climb:      { excitement: 0.5, nausea: 0.2, breakdownBonus: 0.001 },
  dive:       { excitement: 1.2, nausea: 0.8, breakdownBonus: 0.003 },
  loop:       { excitement: 2.0, nausea: 1.5, breakdownBonus: 0.008 },
  super_loop: { excitement: 3.0, nausea: 2.0, breakdownBonus: 0.015 },
};

// ──────────────────────────────────
// Research / Tech Tree
// ──────────────────────────────────
export interface TechNode {
  id: string;
  name: string;
  cost: number;            // Research points needed
  unlocked: boolean;
  facilityIds: FacilityType[];
  dependsOn?: string;      // Prerequisite tech node ID
  line: 'thrill' | 'gentle' | 'service' | 'operations';
}

// ──────────────────────────────────
// Save Data Structure (PRD §9.1)
// ──────────────────────────────────
export interface SaveData {
  version: string;
  park: {
    name: string;
    size: number;
    money: number;
    date: { day: number; month: number };
    rating: number;
    stars: number;
    settings: {
      ticketMode: TicketMode;
      ticketPrice: number;
      speedMultiplier: number;
    };
  };
  roads: RoadTile[];
  facilities: PlacedFacility[];
  staff: { id: string; type: StaffType; zone: StaffPatrolZone }[];
  research: {
    monthlyBudget: number;
    accumulatedPoints: number;
    unlocked: string[];
  };
  visitors: Visitor[];
  economy: {
    loan: LoanState;
    historicalData: MonthData[];
  };
  weather: WeatherType;
  nextWeather: WeatherType;
}
