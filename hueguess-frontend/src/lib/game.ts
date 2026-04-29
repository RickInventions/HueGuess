// Client-side game engine — no backend needed for casual

export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

export interface RoundResult {
  original: HSLColor;
  user: HSLColor;
  accuracy: number;
  accuracyFormatted: string;
  distance: number;
  deltaH: number;
  deltaS: number;
  deltaL: number;
}

export function generateColor(difficulty: 'easy' | 'medium' | 'hard' = 'medium'): HSLColor {
  const h = Math.floor(Math.random() * 360);
  
  let s: number;
  let l: number;
  
  switch (difficulty) {
    case 'easy':
      s = randomInRange(70, 100);
      l = randomInRange(45, 65);
      break;
    case 'hard':
      s = randomInRange(30, 60);
      l = randomInRange(30, 75);
      break;
    case 'medium':
    default:
      s = randomInRange(60, 100);
      l = randomInRange(40, 70);
      break;
  }
  
  return { h, s, l };
}

export function calculateScore(original: HSLColor, user: HSLColor): RoundResult {
  const deltaH = Math.min(
    Math.abs(original.h - user.h),
    360 - Math.abs(original.h - user.h)
  ) / 180;
  
  const deltaS = Math.abs(original.s - user.s) / 100;
  const deltaL = Math.abs(original.l - user.l) / 100;
  
  const distance = Math.sqrt(deltaH ** 2 + deltaS ** 2 + deltaL ** 2);
  const accuracy = Math.max(0, Math.min(100, (1 - distance) * 100));
  const accuracyRounded = Math.round(accuracy * 1000) / 1000;
  
  return {
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

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}