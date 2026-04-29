import { v4 as uuidv4 } from 'uuid';
import type { HSLColor, RoundState, RoundResult, GameMode, Difficulty, StartRoundRequest } from './game.types.js';

// In-memory store for active rounds (no DB needed for casual)
const activeRounds = new Map<string, RoundState>();

// Auto-cleanup rounds older than 30 minutes
const ROUND_TTL = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, round] of activeRounds) {
    if (now - round.createdAt > ROUND_TTL) {
      activeRounds.delete(id);
    }
  }
}, 5 * 60 * 1000);

export function generateColor(difficulty: Difficulty = 'medium'): HSLColor {
  const h = Math.floor(Math.random() * 360);
  
  let s: number;
  let l: number;
  
  switch (difficulty) {
    case 'easy':
      s = randomInRange(70, 100);  // High saturation = easier to distinguish
      l = randomInRange(45, 65);   // Mid-range lightness
      break;
    case 'hard':
      s = randomInRange(30, 60);   // Lower saturation = harder
      l = randomInRange(30, 75);   // Wider range = more variation
      break;
    case 'medium':
    default:
      s = randomInRange(60, 100);
      l = randomInRange(40, 70);
      break;
  }
  
  return { h, s, l };
}

export function startRound(params: StartRoundRequest): { roundId: string; color: HSLColor; memorizationTime: number } {
  const id = uuidv4();
  const color = generateColor(params.difficulty);
  
  const memorizationTime = getMemorizationTime(params.mode);
  
  const round: RoundState = {
    id,
    originalColor: color,
    mode: params.mode || 'casual',
    difficulty: params.difficulty || 'medium',
    memorizationTime,
    createdAt: Date.now(),
  };
  
  activeRounds.set(id, round);
  
  return {
    roundId: id,
    color,
    memorizationTime,
  };
}

export function submitAndGetResult(roundId: string, color: HSLColor): RoundResult {
  const round = activeRounds.get(roundId);
  
  if (!round) {
    throw new Error('Round not found or expired');
  }
  
  const result = calculateScore(round.originalColor, color, roundId);
  
  // Clean up the round after getting results
  activeRounds.delete(roundId);
  
  return result;
}

export function getRound(roundId: string): RoundState | undefined {
  return activeRounds.get(roundId);
}

export function cleanupRound(roundId: string): void {
  activeRounds.delete(roundId);
}

export function calculateScore(original: HSLColor, user: HSLColor, roundId: string): RoundResult {
  // Normalize values (0–1)
  const deltaH = Math.min(
    Math.abs(original.h - user.h),
    360 - Math.abs(original.h - user.h)
  ) / 180;
  
  const deltaS = Math.abs(original.s - user.s) / 100;
  const deltaL = Math.abs(original.l - user.l) / 100;
  
  const distance = Math.sqrt(deltaH ** 2 + deltaS ** 2 + deltaL ** 2);
  
  // Calculate accuracy with 3 decimal places
  const accuracy = Math.max(0, Math.min(100, (1 - distance) * 100));
  const accuracyRounded = Math.round(accuracy * 1000) / 1000; // 3 decimal places
  
  return {
    roundId,
    original,
    user,
    accuracy: accuracyRounded,
    accuracyFormatted: `${accuracyRounded.toFixed(3)}%`,
    distance: Math.round(distance * 1000) / 1000,
    deltaH: Math.round(deltaH * 1000) / 1000,
    deltaS: Math.round(deltaS * 1000) / 1000,
    deltaL: Math.round(deltaL * 1000) / 1000,
  };
}

function getMemorizationTime(mode: GameMode = 'casual'): number {
  switch (mode) {
    case 'competitive':
      return 3;
    case 'challenge':
      return 4;
    case 'casual':
    default:
      return 6;
  }
}

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export { activeRounds };