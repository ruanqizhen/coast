import { create } from 'zustand';
import { CONSTANTS } from '../config/constants';
import type { MonthData, WeatherType, LoanState, GameMessage, TicketMode } from '../types';
import { createDefaultLoan } from '../engine/EconomySystem';

interface GameState {
  // ── Core ──
  money: number;
  day: number;
  month: number;
  rating: number;
  stars: number;
  visitorsCount: number;
  speed: number;
  gamePaused: boolean;
  gridSize: number;

  // ── Weather ──
  weather: WeatherType;
  nextWeather: WeatherType;

  // ── Economy ──
  ticketMode: TicketMode;
  ticketPrice: number;
  loan: LoanState;
  currentMonthRevenue: number;
  currentMonthExpenses: number;
  historicalData: MonthData[];

  // ── Research ──
  researchPoints: number;
  monthlyResearchBudget: number;
  unlockedTechs: string[];

  // ── Messages ──
  messages: GameMessage[];

  // ── Save ──
  currentSaveId: string;
  isSaving: boolean;

  // ── Actions ──
  addMoney: (amount: number) => void;
  deductMoney: (amount: number) => boolean;
  advanceDay: () => void;
  setSpeed: (speed: number) => void;
  togglePause: () => void;
  setRating: (rating: number) => void;
  setStars: (stars: number) => void;
  setWeather: (weather: WeatherType, next?: WeatherType) => void;
  setVisitorsCount: (count: number) => void;
  setResearchBudget: (amount: number) => void;
  unlockTech: (techId: string) => void;

  // Economy actions
  setTicketMode: (mode: TicketMode) => void;
  setTicketPrice: (price: number) => void;
  setLoan: (loan: LoanState) => void;
  setGridSize: (size: number) => void;

  // Messages
  addMessage: (msg: GameMessage) => void;
  removeMessage: (id: string) => void;

  // Save
  setSaving: (saving: boolean) => void;
  setCurrentSaveId: (id: string) => void;

  // Month settlement
  applyMonthSettlement: (data: { revenue: number; expenses: number; satisfaction: number; visitorPeak: number }) => void;
}

const IS_DEBUG = false;

export const useGameState = create<GameState>((set, get) => ({
  money: IS_DEBUG ? 100000 : CONSTANTS.STARTING_MONEY,
  gridSize: CONSTANTS.GRID_SIZE,
  day: 1,
  month: 1,
  stars: IS_DEBUG ? 5 : 0,
  rating: 50,
  visitorsCount: 0,
  speed: 1,
  gamePaused: false,
  weather: 'sunny',
  nextWeather: 'cloudy',
  
  ticketMode: 'paid',
  ticketPrice: 10,
  loan: createDefaultLoan(),
  currentMonthRevenue: 0,
  currentMonthExpenses: 0,
  historicalData: [],
  monthlyResearchBudget: 500,
  researchPoints: IS_DEBUG ? 1000 : 0,
  unlockedTechs: IS_DEBUG 
    ? ['thrill_1', 'thrill_2', 'gentle_1', 'gentle_2', 'service_1', 'service_2', 'service_3', 'ops_1', 'ops_2'] 
    : [],
  messages: [],

  currentSaveId: `park_${Date.now()}`,
  isSaving: false,

  addMoney: (amount) => set((state) => ({
    money: state.money + amount,
    currentMonthRevenue: amount > 0
      ? state.currentMonthRevenue + amount
      : state.currentMonthRevenue,
  })),

  deductMoney: (amount) => {
    const state = get();
    if (state.money >= amount) {
      set({
        money: state.money - amount,
        currentMonthExpenses: state.currentMonthExpenses + amount,
      });
      return true;
    }
    return false;
  },

  advanceDay: () => set((state) => {
    let nextDay = state.day + 1;
    let nextMonth = state.month;
    const historicalData = [...state.historicalData];
    let rp = state.researchPoints;

    if (nextDay > CONSTANTS.DAYS_PER_MONTH) {
      nextDay = 1;
      nextMonth += 1;

      historicalData.push({
        monthIndex: state.month,
        revenue: state.currentMonthRevenue,
        expenses: state.currentMonthExpenses,
        satisfaction: state.rating,
        visitorPeak: state.visitorsCount,
        visitorTotal: 0,
      });

      if (historicalData.length > 12) historicalData.shift();

      rp += Math.floor(state.monthlyResearchBudget / 10);

      return {
        day: nextDay,
        month: nextMonth,
        currentMonthRevenue: 0,
        currentMonthExpenses: 0,
        historicalData,
        researchPoints: rp,
        money: state.money - state.monthlyResearchBudget,
      };
    }
    return { day: nextDay, month: nextMonth };
  }),

  setSpeed: (speed) => set({ speed, gamePaused: speed === 0 }),
  togglePause: () => set((state) => ({ gamePaused: !state.gamePaused })),
  setRating: (rating) => set({ rating }),
  setStars: (stars) => set({ stars }),
  setWeather: (weather, next) => set(next ? { weather, nextWeather: next } : { weather }),
  setVisitorsCount: (count) => set({ visitorsCount: count }),
  setResearchBudget: (amount) => set({ monthlyResearchBudget: amount }),
  unlockTech: (techId) => set((state) => ({ unlockedTechs: [...state.unlockedTechs, techId] })),

  setTicketMode: (mode) => set({ ticketMode: mode }),
  setTicketPrice: (price) => set({ ticketPrice: price }),
  setLoan: (loan) => set({ loan }),
  setGridSize: (size) => set({ gridSize: size }),

  addMessage: (msg) => set((state) => {
    // Ensure ID uniqueness to prevent React key collision errors
    let finalId = msg.id;
    if (state.messages.some(m => m.id === finalId)) {
        finalId = `${msg.id}_${Math.random().toString(36).slice(2, 5)}`;
    }
    const newMsg = { ...msg, id: finalId };
    const messages = [newMsg, ...state.messages].slice(0, 20);
    return { messages };
  }),
  removeMessage: (id) => set((state) => ({
    messages: state.messages.filter(m => m.id !== id),
  })),

  setSaving: (saving) => set({ isSaving: saving }),
  setCurrentSaveId: (id) => set({ currentSaveId: id }),

  applyMonthSettlement: (data) => set((state) => {
    const historicalData = [...state.historicalData];
    historicalData.push({
      monthIndex: state.month,
      revenue: data.revenue,
      expenses: data.expenses,
      satisfaction: data.satisfaction,
      visitorPeak: data.visitorPeak,
      visitorTotal: 0,
    });
    if (historicalData.length > 12) historicalData.shift();
    return { historicalData };
  }),
}));
