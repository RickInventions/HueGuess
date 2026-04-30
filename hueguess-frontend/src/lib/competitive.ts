/* eslint-disable @typescript-eslint/no-explicit-any */
import api from './api';
import type { HSLColor } from './game';

export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type LeaderboardPeriod = 'daily' | 'weekly' | 'all-time';

export interface CompetitiveGameResult {
  id: string;
  userId: string;
  original: HSLColor;
  user: HSLColor;
  accuracy: number;
  accuracyFormatted: string;
  ratingChange: number;
  newRating: number;
  rankTier: RankTier;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  avgAccuracy: number;
  gamesPlayed: number;
  rankTier: RankTier;
}

export interface CompetitiveStats {
  userId: string;
  username: string;
  rating: number;
  avgAccuracy: number;
  gamesPlayed: number;
  bestScore: number;
  rankTier: RankTier;
  rank: number;
}

export interface StartCompetitiveResponse {
  roundId: string;
  color: HSLColor;
  memorizationTime: number;
}

export async function startCompetitiveRound(): Promise<StartCompetitiveResponse> {
  const response = await api.post('/competitive/start') as any;
  return response.data;
}

export async function submitCompetitiveRound(
  roundId: string,
  h: number,
  s: number,
  l: number,
  memorizationTime: number
): Promise<CompetitiveGameResult> {
  const response = await api.post('/competitive/submit', {
    roundId,
    h,
    s,
    l,
    memorizationTime,
  }) as any;
  return response.data;
}

export async function getLeaderboard(
  period: LeaderboardPeriod = 'all-time',
  limit: number = 100
): Promise<{ period: string; entries: LeaderboardEntry[] }> {
  const response = await api.get('/competitive/leaderboard', {
    params: { period, limit },
  }) as any;
  return response.data;
}

export async function getUserStats(): Promise<CompetitiveStats> {
  const response = await api.get('/competitive/stats') as any;
  return response.data;
}