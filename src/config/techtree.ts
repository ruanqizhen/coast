import type { TechNode } from '../types';

export const TECH_TREE: Record<string, TechNode> = {
  thrill_1: {
    id: 'thrill_1',
    name: '进阶刺激设施',
    cost: 40,
    unlocked: false,
    facilityIds: ['drop_tower'],
  },
  thrill_2: {
    id: 'thrill_2',
    name: '极致刺激体验',
    cost: 80,
    unlocked: false,
    facilityIds: ['launch_coaster'],
    dependsOn: 'thrill_1'
  },
  gentle_1: {
    id: 'gentle_1',
    name: '家庭互动游乐',
    cost: 25,
    unlocked: false,
    facilityIds: ['bumper_cars']
  },
  gentle_2: {
    id: 'gentle_2',
    name: '沉浸暗黑骑乘',
    cost: 55,
    unlocked: false,
    facilityIds: ['dark_ride'],
    dependsOn: 'gentle_1'
  }
};
