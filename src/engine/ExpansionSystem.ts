import { CONSTANTS } from '../config/constants';

/**
 * ExpansionSystem: handles land expansion logic.
 */
export class ExpansionSystem {
  /** Check if expansion is available */
  static canExpand(currentSize: number, stars: number, money: number): { canExpand: boolean; reason: string } {
    if (currentSize >= CONSTANTS.MAX_GRID_SIZE) {
      return { canExpand: false, reason: '已达到最大地块尺寸 128×128' };
    }

    const nextSize = currentSize + CONSTANTS.EXPANSION_STEP;

    // Star requirements for specific sizes
    if (nextSize > 64 && nextSize <= 96 && stars < 3) {
      return { canExpand: false, reason: `需要 ★★★ 评级才能扩张至 ${nextSize}×${nextSize}` };
    }
    if (nextSize > 96 && stars < 5) {
      return { canExpand: false, reason: `需要 ★★★★★ 评级才能扩张至 ${nextSize}×${nextSize}` };
    }

    if (money < CONSTANTS.EXPANSION_COST) {
      return { canExpand: false, reason: `资金不足（需要 $${CONSTANTS.EXPANSION_COST}）` };
    }

    return { canExpand: true, reason: '' };
  }

  /** Get the next expansion size */
  static getNextSize(currentSize: number): number {
    return Math.min(currentSize + CONSTANTS.EXPANSION_STEP, CONSTANTS.MAX_GRID_SIZE);
  }

  /** Get expansion cost */
  static getCost(): number {
    return CONSTANTS.EXPANSION_COST;
  }

  /** Get all expansion stages */
  static getStages(): { size: number; starsRequired: number; cost: number }[] {
    return [
      { size: 80, starsRequired: 0, cost: CONSTANTS.EXPANSION_COST },
      { size: 96, starsRequired: 3, cost: CONSTANTS.EXPANSION_COST },
      { size: 112, starsRequired: 3, cost: CONSTANTS.EXPANSION_COST },
      { size: 128, starsRequired: 5, cost: CONSTANTS.EXPANSION_COST },
    ];
  }
}
