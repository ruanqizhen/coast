import { create } from 'zustand';
import { CONSTANTS } from '../config/constants';
import type { MonthData, WeatherType } from '../types';

interface GameState {
  money: number;
  day: number;
  month: number;
  rating: number;
  visitorsCount: number; // Added to decouple direct array length checks in React map
  speed: number;
  gamePaused: boolean;
  weather: WeatherType;
  historicalData: MonthData[]; // Phase 2: Historical tracking

  currentMonthRevenue: number;
  currentMonthExpenses: number;

  // Actions
  addMoney: (amount: number) => void;
  deductMoney: (amount: number) => boolean;
  advanceDay: () => void;
  setSpeed: (speed: number) => void;
  togglePause: () => void;
  setRating: (rating: number) => void;
  setWeather: (weather: WeatherType) => void;
  setVisitorsCount: (count: number) => void;
}

export const useGameState = create<GameState>((set, get) => ({
  money: CONSTANTS.STARTING_MONEY,
  day: 1,
  month: 1,
  rating: 50.0, // Switched to 0-100 scale based on PRD Phase 2
  visitorsCount: 0,
  speed: 1,
  gamePaused: false,
  weather: 'sunny',
  historicalData: [],

  currentMonthRevenue: 0,
  currentMonthExpenses: 0,

  addMoney: (amount) => set((state) => ({ 
    money: state.money + amount,
    currentMonthRevenue: state.currentMonthRevenue + amount
  })),
  
  deductMoney: (amount) => {
    const state = get();
    if (state.money >= amount) {
      set({ 
        money: state.money - amount,
        currentMonthExpenses: state.currentMonthExpenses + amount
      });
      return true;
    }
    return false;
  },

  advanceDay: () => set((state) => {
    let nextDay = state.day + 1;
    let nextMonth = state.month;
    let historicalData = [...state.historicalData];
    
    // Month transition
    if (nextDay > 30) {
      nextDay = 1;
      nextMonth += 1;
      
      // Save historical data
      historicalData.push({
        monthIndex: state.month,
        revenue: state.currentMonthRevenue,
        expenses: state.currentMonthExpenses,
        satisfaction: state.rating
      });

      // Keep only last 12 months
      if (historicalData.length > 12) {
        historicalData.shift();
      }

      return { 
        day: nextDay, 
        month: nextMonth, 
        currentMonthRevenue: 0, 
        currentMonthExpenses: 0,
        historicalData 
      };
    }
    return { day: nextDay, month: nextMonth };
  }),

  setSpeed: (speed) => set({ speed }),
  togglePause: () => set((state) => ({ gamePaused: !state.gamePaused })),
  setRating: (rating) => set({ rating }),
  setWeather: (weather) => set({ weather }),
  setVisitorsCount: (count) => set({ visitorsCount: count }),
}));
