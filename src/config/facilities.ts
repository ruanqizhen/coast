import type { FacilityDef } from '../types';

export const FACILITIES: Record<string, FacilityDef> = {
  // ── Thrill ──
  coaster_basic: {
    id: 'coaster_basic', name: '基础过山车', category: 'thrill',
    sizeX: 6, sizeZ: 12, buildCost: 2500, monthlyUpkeep: 80,
    excitement: 8, nausea: 6, appeal: 90,
    capacity: 24, rideDuration: 30000, isOutdoor: true,
  },
  pirate_ship: {
    id: 'pirate_ship', name: '海盗船', category: 'thrill',
    sizeX: 4, sizeZ: 4, buildCost: 1200, monthlyUpkeep: 40,
    excitement: 6, nausea: 5, appeal: 70,
    capacity: 30, rideDuration: 20000, isOutdoor: true,
  },
  drop_tower: {
    id: 'drop_tower', name: '跳楼机', category: 'thrill',
    sizeX: 3, sizeZ: 3, buildCost: 1800, monthlyUpkeep: 55,
    excitement: 9, nausea: 4, appeal: 85,
    capacity: 16, rideDuration: 15000, isOutdoor: true,
    requiresTech: 'thrill_1',
  },
  launch_coaster: {
    id: 'launch_coaster', name: '弹射过山车', category: 'thrill',
    sizeX: 8, sizeZ: 14, buildCost: 5000, monthlyUpkeep: 150,
    excitement: 10, nausea: 7, appeal: 100,
    capacity: 20, rideDuration: 45000, isOutdoor: true,
    requiresTech: 'thrill_2', requiresStars: 4,
  },

  // ── Gentle ──
  merry_go_round: {
    id: 'merry_go_round', name: '旋转木马', category: 'gentle',
    sizeX: 3, sizeZ: 3, buildCost: 600, monthlyUpkeep: 15,
    excitement: 2, nausea: 1, appeal: 45,
    capacity: 20, rideDuration: 15000, isOutdoor: true,
  },
  ferris_wheel: {
    id: 'ferris_wheel', name: '摩天轮', category: 'gentle',
    sizeX: 5, sizeZ: 5, buildCost: 1800, monthlyUpkeep: 50,
    excitement: 3, nausea: 2, appeal: 65,
    capacity: 40, rideDuration: 25000, isOutdoor: true,
  },
  bumper_cars: {
    id: 'bumper_cars', name: '碰碰车', category: 'gentle',
    sizeX: 4, sizeZ: 4, buildCost: 900, monthlyUpkeep: 25,
    excitement: 4, nausea: 1, appeal: 55,
    capacity: 12, rideDuration: 18000, isOutdoor: false,
    requiresTech: 'gentle_1',
  },
  dark_ride: {
    id: 'dark_ride', name: '暗黑骑乘', category: 'gentle',
    sizeX: 5, sizeZ: 8, buildCost: 2200, monthlyUpkeep: 70,
    excitement: 5, nausea: 3, appeal: 75,
    capacity: 24, rideDuration: 30000, isOutdoor: false,
    requiresTech: 'gentle_2', requiresStars: 4,
  },

  // ── Shops ──
  burger_stall: {
    id: 'burger_stall', name: '薯条摊', category: 'shop',
    sizeX: 2, sizeZ: 2, buildCost: 300, monthlyUpkeep: 10,
    appeal: 30, capacity: 20, costRate: 0.3, isOutdoor: true,
  },
  drink_stall: {
    id: 'drink_stall', name: '汽水摊', category: 'shop',
    sizeX: 2, sizeZ: 2, buildCost: 280, monthlyUpkeep: 10,
    appeal: 30, capacity: 20, costRate: 0.3, isOutdoor: true,
  },
  restaurant: {
    id: 'restaurant', name: '高级餐厅', category: 'shop',
    sizeX: 4, sizeZ: 4, buildCost: 1500, monthlyUpkeep: 60,
    appeal: 30, capacity: 30, costRate: 0.3, isOutdoor: false,
    requiresTech: 'service_1',
  },

  // ── Facility (infrastructure) ──
  restroom: {
    id: 'restroom', name: '洗手间', category: 'facility',
    sizeX: 2, sizeZ: 3, buildCost: 400, monthlyUpkeep: 20,
    appeal: 10, capacity: 4, isOutdoor: false,
  },
  bench: {
    id: 'bench', name: '长椅', category: 'facility',
    sizeX: 1, sizeZ: 1, buildCost: 50, monthlyUpkeep: 0,
    appeal: 5, capacity: 2, isOutdoor: true,
  },
  trash_can: {
    id: 'trash_can', name: '垃圾桶', category: 'facility',
    sizeX: 1, sizeZ: 1, buildCost: 30, monthlyUpkeep: 0,
    appeal: 0, capacity: 50, isOutdoor: true,  // capacity = trash capacity
  },
  first_aid: {
    id: 'first_aid', name: '急救站', category: 'facility',
    sizeX: 2, sizeZ: 2, buildCost: 500, monthlyUpkeep: 30,
    appeal: 10, capacity: 2, isOutdoor: false,
    requiresTech: 'service_2',
  },

  // ── Scenery ──
  flower_bed: {
    id: 'flower_bed', name: '花坛', category: 'scenery',
    sizeX: 1, sizeZ: 1, buildCost: 80, monthlyUpkeep: 5,
    appeal: 5, envRadius: 3, envBoost: 5, isOutdoor: true,
  },
  fountain: {
    id: 'fountain', name: '喷泉', category: 'scenery',
    sizeX: 2, sizeZ: 2, buildCost: 350, monthlyUpkeep: 10,
    appeal: 15, envRadius: 5, envBoost: 15, isOutdoor: true,
  },
  weather_tent: {
    id: 'weather_tent', name: '天气帐篷', category: 'scenery',
    sizeX: 3, sizeZ: 3, buildCost: 800, monthlyUpkeep: 20,
    appeal: 10, capacity: 20, envRadius: 4, envBoost: 5, isOutdoor: false,
    requiresTech: 'service_3',
  },
};

/** Default ticket prices per facility */
export const DEFAULT_TICKET_PRICES: Record<string, number> = {
  coaster_basic: 5,
  pirate_ship: 4,
  drop_tower: 5,
  launch_coaster: 8,
  merry_go_round: 3,
  ferris_wheel: 4,
  bumper_cars: 3,
  dark_ride: 5,
  burger_stall: 4,
  drink_stall: 3,
  restaurant: 8,
};
