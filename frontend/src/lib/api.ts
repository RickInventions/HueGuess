import axios from 'axios';
import type { Difficulty, GameRoundResponse, GameMode, HSLColor, SubmitGuessResponse, CompetitiveStats } from '../types';
import type {
  FriendOverviewResponse,
  FriendRelationship,
  FriendSearchResult,
} from '../types/friends';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 from the auth endpoints themselves is a failed sign-in attempt, not an
    // expired session — treating it as one wiped storage and fired a second global
    // logout on top of the first, which is where the duplicate toast came from.
    const url: string = error.config?.url ?? '';
    const isAuthAttempt = /\/auth\/(login|register|verify|verify-code|resend-verification|forgot-password|reset-password)/.test(url);

    if (error.response?.status === 401 && !isAuthAttempt) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const auth = {
  register: (username: string, email: string, password: string) =>
    api.post('/auth/register', { username, email, password }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  verifyEmail: (token: string, email: string) =>
    api.get('/auth/verify', { params: { token, email } }),
  verifyWithCode: (email: string, code: string) =>
    api.post('/auth/verify-code', { email, code }),
  resendVerification: (email: string) =>
    api.post('/auth/resend-verification', { email }),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, email: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, email, newPassword }),
  getMe: () => api.get('/auth/me'),
};

// Game endpoints
export const game = {
  generateRound: (difficulty: Difficulty) =>
    api.post<GameRoundResponse>('/game/generate', { difficulty }),
  submitGuess: (
    mode: GameMode,
    difficulty: Difficulty,
    originalColor: HSLColor,
    userColor: HSLColor,
    memorizationSeconds: number
  ) =>
    api.post<SubmitGuessResponse>('/game/submit', {
      mode,
      difficulty,
      originalH: originalColor.h,
      originalS: originalColor.s,
      originalL: originalColor.l,
      userH: userColor.h,
      userS: userColor.s,
      userL: userColor.l,
      memorizationSeconds,
    }),
  registerReloadPenalty: (
    mode: GameMode,
    difficulty: Difficulty,
    originalColor: HSLColor,
    memorizationSeconds: number
  ) =>
    api.post('/game/reload-penalty', {
      mode,
      difficulty,
      originalH: originalColor.h,
      originalS: originalColor.s,
      originalL: originalColor.l,
      memorizationSeconds,
    }),
  getDifficulties: () => api.get('/game/difficulties'),
};

// Stats endpoints
export const stats = {
  getMyStats: () => api.get<{ success: boolean; stats: CompetitiveStats }>('/stats/me'),
  getRankThresholds: () => api.get('/stats/rank-thresholds'),
};

// Leaderboard endpoints
export const leaderboard = {
  getLeaderboard: (params: {
    period?: 'all-time' | 'weekly' | 'daily';
    sortBy?: 'points' | 'gamesPlayed' | 'avgAccuracy' | 'streak';
    sortOrder?: 'ASC' | 'DESC';
    search?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/leaderboard', { params }),
  getAwards: () => api.get('/leaderboard/awards'),
  getGlobalStats: () => api.get('/leaderboard/global-stats'),
  getTopPlayers: (limit: number = 3) => 
    api.get('/leaderboard', { params: { limit, sortBy: 'points', sortOrder: 'DESC' } }),
};

// Achievement endpoints
export const achievements = {
  getAll: () => api.get('/achievements'),
  getMine: () => api.get('/achievements/me'),
  /** Unlocked but not yet acknowledged — drives the "new" panel on Home. */
  getRecent: () => api.get('/achievements/recent/unseen'),
  /** Called when the Achievements page is opened, which is what clears the panel. */
  markAllSeen: () => api.post('/achievements/mark-all-seen'),
};

// Daily challenge endpoints
export const daily = {
  getToday: () => api.get('/daily/today'),
  submit: (challengeId: string, userColor: HSLColor, timeTakenMs: number) =>
    api.post('/daily/submit', {
      challengeId,
      userH: userColor.h,
      userS: userColor.s,
      userL: userColor.l,
      timeTakenMs,
    }),
  getLeaderboard: (challengeId: string, limit?: number) =>
    api.get(`/daily/leaderboard/${challengeId}`, { params: { limit } }),
};

// User endpoints
export const user = {
  getPublicProfile: (username: string) => api.get(`/user/profile/${username}`),
  getOwnProfile: () => api.get('/user/me'),
  changeUsername: (newUsername: string) => api.put('/user/username', { newUsername }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/user/password', { currentPassword, newPassword }),
  searchUsers: (query: string, limit?: number) =>
    api.get('/user/search', { params: { q: query, limit } }),
};

// Friend endpoints
export const friends = {
  /** Friends + pending requests in both directions, with live online flags. */
  list: () => api.get<FriendOverviewResponse>('/friends'),
  search: (query: string) =>
    api.get<{ success: boolean; results: FriendSearchResult[] }>('/friends/search', {
      params: { q: query },
    }),
  status: (userId: string) =>
    api.get<{ success: boolean; relationship: FriendRelationship }>(`/friends/status/${userId}`),
  /** Resolves with status 'accepted' when this crossed an incoming request. */
  request: (userId: string) =>
    api.post<{ success: boolean; status: 'pending' | 'accepted' }>('/friends/request', { userId }),
  accept: (userId: string) => api.post('/friends/accept', { userId }),
  decline: (userId: string) => api.post('/friends/decline', { userId }),
  /** Withdraw a request you sent. */
  cancel: (userId: string) => api.post('/friends/cancel', { userId }),
  remove: (userId: string) => api.delete(`/friends/${userId}`),
};

// Feedback endpoints
export const feedback = {
  submit: (type: string, title: string, description: string, contactEmail?: string) =>
    api.post('/feedback', { type, title, description, contactEmail }),
};

// Admin endpoints live in ./adminApi — it sources the key from localStorage and
// clears it on a 401. Don't add a second admin client here.

export default api;