import { create } from 'zustand';
import type { HSLColor, SubmitResultResponse } from '@/lib/game';

export type GamePhase = 
  | 'idle'
  | 'memorizing'
  | 'adjusting'
  | 'submitted'
  | 'results';

interface GameState {
  phase: GamePhase;
  roundId: string | null;
  targetColor: HSLColor | null;
  userColor: HSLColor;
  memorizationTime: number;
  timeRemaining: number;
  result: SubmitResultResponse | null;
  
  // Actions
  setPhase: (phase: GamePhase) => void;
  startMemorizing: (roundId: string, color: HSLColor, time: number) => void;
  startAdjusting: () => void;
  setUserColor: (color: Partial<HSLColor>) => void;
  setResult: (result: SubmitResultResponse) => void;
  reset: () => void;
}

const defaultUserColor: HSLColor = { h: 180, s: 50, l: 50 };

export const useGameStore = create<GameState>((set) => ({
  phase: 'idle',
  roundId: null,
  targetColor: null,
  userColor: defaultUserColor,
  memorizationTime: 0,
  timeRemaining: 0,
  result: null,
  
  setPhase: (phase) => set({ phase }),
  
  startMemorizing: (roundId, color, time) => set({
    roundId,
    targetColor: color,
    memorizationTime: time,
    timeRemaining: time,
    phase: 'memorizing',
    result: null,
  }),
  
  startAdjusting: () => set({
    phase: 'adjusting',
    userColor: defaultUserColor,
  }),
  
  setUserColor: (color) => set((state) => ({
    userColor: { ...state.userColor, ...color },
  })),
  
  setResult: (result) => set({
    result,
    phase: 'results',
  }),
  
  reset: () => set({
    phase: 'idle',
    roundId: null,
    targetColor: null,
    userColor: defaultUserColor,
    memorizationTime: 0,
    timeRemaining: 0,
    result: null,
  }),
}));