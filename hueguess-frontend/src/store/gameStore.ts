import { create } from 'zustand';
import type { HSLColor, RoundResult } from '@/lib/game';
import { generateColor, calculateScore } from '@/lib/game';

export type GamePhase = 
  | 'idle'
  | 'memorizing'
  | 'adjusting'
  | 'submitted'
  | 'results';

interface GameState {
  phase: GamePhase;
  targetColor: HSLColor | null;
  userColor: HSLColor;
  memorizationTime: number;
  timeRemaining: number;
  result: RoundResult | null;
  
  // Actions (client-side, no API)
  startRound: () => void;
  setPhase: (phase: GamePhase) => void;
  setUserColor: (color: Partial<HSLColor>) => void;
  submitGuess: () => void;
  reset: () => void;
}

const defaultUserColor: HSLColor = { h: 180, s: 50, l: 50 };
const MEMORIZATION_TIME = 2; // seconds for casual

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'idle',
  targetColor: null,
  userColor: defaultUserColor,
  memorizationTime: MEMORIZATION_TIME,
  timeRemaining: MEMORIZATION_TIME,
  result: null,
  
  startRound: () => {
    const color = generateColor('medium');
    set({
      targetColor: color,
      memorizationTime: MEMORIZATION_TIME,
      timeRemaining: MEMORIZATION_TIME,
      phase: 'memorizing',
      result: null,
      userColor: defaultUserColor,
    });
  },
  
  setPhase: (phase) => set({ phase }),
  
  setUserColor: (color) => set((state) => ({
    userColor: { ...state.userColor, ...color },
  })),
  
  submitGuess: () => {
    const { targetColor, userColor } = get();
    if (!targetColor) return;
    
    set({ phase: 'submitted' });
    
    // Small delay for dramatic effect
    setTimeout(() => {
      const result = calculateScore(targetColor, userColor);
      set({ result, phase: 'results' });
    }, 400);
  },
  
  reset: () => set({
    phase: 'idle',
    targetColor: null,
    userColor: defaultUserColor,
    memorizationTime: MEMORIZATION_TIME,
    timeRemaining: MEMORIZATION_TIME,
    result: null,
  }),
}));