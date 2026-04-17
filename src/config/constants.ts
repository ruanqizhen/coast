import type { StarRequirement } from '../types';

export const CONSTANTS = {
  // ── Grid ──
  GRID_SIZE: 64,          // Starting grid (expandable)
  MAX_GRID_SIZE: 128,
  CELL_SIZE: 2,           // 1 cell = 2 meters
  EXPANSION_STEP: 16,     // +16 cells per expansion
  EXPANSION_COST: 2000,

  // ── Time ──
  TICK_RATE_MS: 1000,
  DAY_DURATION_MS: 60000, // 60 seconds per game day
  DAYS_PER_MONTH: 30,
  MONTHS_PER_YEAR: 12,

  // ── Economy ──
  STARTING_MONEY: 5000,
  MAX_LOAN: 5000,
  LOAN_MONTHLY_RATE: 0.015,  // 1.5%
  DEFAULT_TICKET_PRICE: 0,   // Free entry by default
  TICKET_DEMAND_PENALTY: 0.08, // Per $10 increase → ~8% fewer visitors
  DEMOLISH_REFUND_RATE: 0.4,
  DEMOLISH_REFUND_RATE_FIRST_MONTH: 0.7,
  MAINTENANCE_RATE: 0.02,     // BuildCost × 2% / month

  // ── Visitors ──
  VISITOR_SOFT_CAP: 800,
  VISITOR_HARD_CAP: 1000,
  VISITOR_MIN_MONEY: 20,
  VISITOR_MAX_MONEY: 80,
  VISITOR_DECISION_INTERVAL: 3000, // 3 seconds
  VISITOR_SCAN_RADIUS: 5,         // 5 grid cells
  VISITOR_DEFAULT_PATIENCE_MIN: 60,
  VISITOR_DEFAULT_PATIENCE_MAX: 120,

  // ── Needs Decay Rates (per second) ──
  NEEDS: {
    HUNGER_DECAY: 0.8,
    THIRST_DECAY: 1.2,
    TOILET_DECAY: 0.5,
    FATIGUE_DECAY: 0.3,
    FUN_DECAY: 0.6,
    // Trigger thresholds
    HUNGER_THRESHOLD: 30,    // < 30 → seek food (inverted: hunger rises)
    THIRST_THRESHOLD: 25,
    TOILET_THRESHOLD: 70,    // > 70 → seek restroom
    FATIGUE_THRESHOLD: 60,
    NAUSEA_VOMIT_THRESHOLD: 50,
    NAUSEA_FIRSTAID_THRESHOLD: 80,
    FUN_THRESHOLD: 40,       // < 40 → seek ride
  },

  // ── Staff ──
  STAFF_SALARY: {
    cleaner: 60,
    mechanic: 90,
    security: 70,
    entertainer: 50,
  } as Record<string, number>,
  STAFF_SPEED: {
    cleaner: 1.2,
    mechanic: 1.0,
    security: 1.4,
    entertainer: 0.8,
  } as Record<string, number>,
  STAFF_HIRE_COST: {
    cleaner: 100,
    mechanic: 150,
    security: 120,
    entertainer: 80,
  } as Record<string, number>,
  DEFAULT_PATROL_SIZE: 8,
  MECHANIC_INSPECT_INTERVAL: 60000, // 60 seconds
  MECHANIC_REPAIR_TIME: 15000,      // 15 seconds
  ENTERTAINER_RADIUS: 3,            // grid cells
  ENTERTAINER_WORK_DURATION: 1200000,// 20 min
  ENTERTAINER_REST_DURATION: 300000, // 5 min

  // ── Satisfaction ──
  SATISFACTION_WEIGHTS: {
    experience: 0.4,
    cleanliness: 0.3,
    value: 0.2,
    service: 0.1,
  },

  // ── Weather probabilities ──
  WEATHER_PROBS: {
    sunny: 0.50,
    cloudy: 0.25,
    light_rain: 0.15,
    heavy_rain: 0.08,
    holiday: 0.02,
  } as Record<string, number>,
  WEATHER_VISITOR_MULT: {
    sunny: 1.2,
    cloudy: 1.0,
    light_rain: 0.7,
    heavy_rain: 0.4,
    holiday: 1.5,
  } as Record<string, number>,

  // ── Road costs ──
  ROAD_COST: {
    normal: 5,
    wide: 9,
    staff: 3,
  } as Record<string, number>,

  // ── Pathfinding ──
  PATHFINDING_MAX_PER_FRAME: 20,
  PATHFINDING_REBUILD_DELAY: 200, // ms

  // ── Save ──
  AUTO_SAVE_INTERVAL: 300000, // 5 minutes
  SAVE_DB_NAME: 'coast_save',
  SAVE_STORE_NAME: 'parks',

  // ── Age group preferences ──
  AGE_PREFERENCES: {
    child:  { thrillWeight: 0.4, gentleWeight: 1.8, shopWeight: 1.2 },
    teen:   { thrillWeight: 1.5, gentleWeight: 0.8, shopWeight: 1.0 },
    adult:  { thrillWeight: 1.0, gentleWeight: 1.0, shopWeight: 1.3 },
    family: { thrillWeight: 1.1, gentleWeight: 1.3, shopWeight: 1.5 },
  } as Record<string, { thrillWeight: number; gentleWeight: number; shopWeight: number }>,
};

export const STAR_REQUIREMENTS: StarRequirement[] = [
  { stars: 1, satisfactionMin: 30, visitorMin: 50,  unlockDescription: '基础设施全集' },
  { stars: 2, satisfactionMin: 50, visitorMin: 150, unlockDescription: '研发树第二排' },
  { stars: 3, satisfactionMin: 65, visitorMin: 300, unlockDescription: '地块扩张至 96×96' },
  { stars: 4, satisfactionMin: 78, visitorMin: 500, unlockDescription: '弹射过山车、暗黑骑乘' },
  { stars: 5, satisfactionMin: 90, visitorMin: 800, unlockDescription: '地块扩张至 128×128，成就徽章' },
];
