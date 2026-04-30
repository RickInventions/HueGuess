import { create } from 'zustand';
import type { HSLColor } from '@/lib/game';
import type { CompetitiveGameResult } from '@/lib/competitive';

export type CompetitivePhase = 
  | 'idle'
  | 'memorizing'
  | 'adjusting'
  | 'submitting'
  | 'results';

interface CompetitiveState {
  phase: CompetitivePhase;
  roundId: string | null;
  targetColor: HSLColor | null;
  userColor: HSLColor;
  memorizationTime: number;
  result: CompetitiveGameResult | null;
  error: string | null;
  
  setPhase: (phase: CompetitivePhase) => void;
  startMemorizing: (roundId: string, color: HSLColor, time: number) => void;
  startAdjusting: () => void;
  setUserColor: (color: Partial<HSLColor>) => void;
  setResult: (result: CompetitiveGameResult) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const defaultUserColor: HSLColor = { h: 180, s: 50, l: 50 };

export const useCompetitiveStore = create<CompetitiveState>((set) => ({
  phase: 'idle',
  roundId: null,
  targetColor: null,
  userColor: defaultUserColor,
  memorizationTime: 0,
  result: null,
  error: null,
  
  setPhase: (phase) => set({ phase }),
  
  startMemorizing: (roundId, color, time) => set({
    roundId,
    targetColor: color,
    memorizationTime: time,
    phase: 'memorizing',
    result: null,
    error: null,
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
  
  setError: (error) => set({ error }),
  
  reset: () => set({
    phase: 'idle',
    roundId: null,
    targetColor: null,
    userColor: defaultUserColor,
    memorizationTime: 0,
    result: null,
    error: null,
  }),
}));