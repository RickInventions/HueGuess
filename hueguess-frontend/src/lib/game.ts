/* eslint-disable @typescript-eslint/no-explicit-any */
import api from './api';

export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

export interface StartRoundResponse {
  roundId: string;
  color: HSLColor;
  memorizationTime: number;
}

export interface SubmitResultResponse {
  roundId: string;
  original: HSLColor;
  user: HSLColor;
  accuracy: number;
  accuracyFormatted: string;
  distance: number;
  deltaH: number;
  deltaS: number;
  deltaL: number;
}

export async function startRound(difficulty: string = 'medium'): Promise<StartRoundResponse> {
  const response = await api.post('/round/start', {
    mode: 'casual',
    difficulty,
  }) as any;
  return response.data;
}

export async function submitColor(
  roundId: string,
  h: number,
  s: number,
  l: number
): Promise<SubmitResultResponse> {
  const response = await api.post('/round/submit', {
    roundId,
    h,
    s,
    l,
  }) as any;
  return response.data;
}