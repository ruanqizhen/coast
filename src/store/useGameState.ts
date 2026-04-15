import { create } from 'zustand';
import { CONSTANTS } from '../config/constants';

interface GameState {
  money: number;
  day: number;
  month: number;
  rating: number;
  visitors: number;
  speed: number;
  gamePaused: boolean;
  weather: 'sunny' | 'cloudy' | 'rain';
  
  // Actions
  addMoney: (amount: number) => void;
  deductMoney: (amount: number) => boolean;
  advanceDay: () => void;
  setSpeed: (speed: number) => void;
  togglePause: () => void;
}

export const useGameState = create<GameState>((set, get) => ({
  money: CONSTANTS.STARTING_MONEY,
  day: 1,
  month: 1,
  rating: 1.0,
  visitors: 0,
  speed: 1,
  gamePaused: false,
  weather: 'sunny',

  addMoney: (amount) => set((state) => ({ money: state.money + amount })),
  
  deductMoney: (amount) => {
    const { money } = get();
    if (money >= amount) {
      set({ money: money - amount });
      return true;
    }
    return false;
  },

  advanceDay: () => set((state) => {
    let nextDay = state.day + 1;
    let nextMonth = state.month;
    if (nextDay > 30) {
      nextDay = 1;
      nextMonth += 1;
    }
    return { day: nextDay, month: nextMonth };
  }),

  setSpeed: (speed) => set({ speed }),
  
  togglePause: () => set((state) => ({ gamePaused: !state.gamePaused })),
}));
