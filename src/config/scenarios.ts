export interface ScenarioDef {
  id: string;
  name: string;
  description: string;
  /** Starting conditions */
  startMoney: number;
  startGridSize: number;
  startLoan: number; // Initial loan principal
  /** Win conditions (all must be met) */
  winStars: number;
  winVisitors: number;
  winDay?: number;   // Must reach conditions by this day
  winMoney?: number; // Must accumulate this much money
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'scratch',
    name: '从零开始',
    description: '资金有限，地块狭小。在 60 天内将这片荒地打造成一座三星级公园。',
    startMoney: 2000,
    startGridSize: 48,
    startLoan: 0,
    winStars: 3,
    winVisitors: 200,
    winDay: 60,
  },
  {
    id: 'debt',
    name: '负债经营',
    description: '接手一座负债累累的公园。你有 90 天时间扭亏为盈，还清贷款并达到 500 名游客。',
    startMoney: 1500,
    startGridSize: 64,
    startLoan: 3000,
    winStars: 3,
    winVisitors: 500,
    winDay: 90,
    winMoney: 10000,
  },
  {
    id: 'tycoon',
    name: '主题公园大亨',
    description: '你有充足的启动资金，但目标也更宏大：五星评级 + 1000 名游客。证明你是真正的公园大亨。',
    startMoney: 10000,
    startGridSize: 80,
    startLoan: 0,
    winStars: 5,
    winVisitors: 1000,
    winDay: 120,
  },
];

/** Sandbox mode: no win conditions */
export const SANDBOX_MODE: ScenarioDef = {
  id: 'sandbox',
  name: '沙盒模式',
  description: '自由建造，无任何限制。尽情发挥你的创意。',
  startMoney: 50000,
  startGridSize: 128,
  startLoan: 0,
  winStars: 0,
  winVisitors: 0,
};
