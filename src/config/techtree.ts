import type { TechNode } from '../types';

export const TECH_TREE: Record<string, TechNode> = {
  // ── Thrill Line ──
  thrill_1: {
    id: 'thrill_1',
    name: '进阶刺激设施',
    cost: 40,
    unlocked: false,
    facilityIds: ['drop_tower'],
    line: 'thrill',
  },
  thrill_2: {
    id: 'thrill_2',
    name: '极致刺激体验',
    cost: 80,
    unlocked: false,
    facilityIds: ['launch_coaster'],
    dependsOn: 'thrill_1',
    line: 'thrill',
  },

  // ── Gentle / Family Line ──
  gentle_1: {
    id: 'gentle_1',
    name: '家庭互动游乐',
    cost: 25,
    unlocked: false,
    facilityIds: ['bumper_cars'],
    line: 'gentle',
  },
  gentle_2: {
    id: 'gentle_2',
    name: '沉浸暗黑骑乘',
    cost: 55,
    unlocked: false,
    facilityIds: ['dark_ride'],
    dependsOn: 'gentle_1',
    line: 'gentle',
  },

  // ── Service Upgrade Line ──
  service_1: {
    id: 'service_1',
    name: '高级餐饮服务',
    cost: 30,
    unlocked: false,
    facilityIds: ['restaurant'],
    line: 'service',
  },
  service_2: {
    id: 'service_2',
    name: '医疗升级',
    cost: 35,
    unlocked: false,
    facilityIds: ['first_aid'],
    dependsOn: 'service_1',
    line: 'service',
  },
  service_3: {
    id: 'service_3',
    name: '天气防护设施',
    cost: 45,
    unlocked: false,
    facilityIds: ['weather_tent'],
    dependsOn: 'service_2',
    line: 'service',
  },

  // ── Operations Efficiency Line ──
  ops_1: {
    id: 'ops_1',
    name: '寻路优化',
    cost: 20,
    unlocked: false,
    facilityIds: [],
    line: 'operations',
  },
  ops_2: {
    id: 'ops_2',
    name: '智能调价系统',
    cost: 50,
    unlocked: false,
    facilityIds: [],
    dependsOn: 'ops_1',
    line: 'operations',
  },
};
