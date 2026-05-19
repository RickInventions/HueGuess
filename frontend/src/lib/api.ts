import axios from 'axios';
import { Difficulty, GameRoundResponse, GameMode, HSLColor, SubmitGuessResponse, CompetitiveStats } from '../types';

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
    if (error.response?.status === 401) {
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
  getRecent: () => api.get('/achievements/recent/unseen'),
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

// Feedback endpoints
export const feedback = {
  submit: (type: string, title: string, description: string, contactEmail?: string) =>
    api.post('/feedback', { type, title, description, contactEmail }),
};

// Admin endpoints (requires admin key)
export const admin = {
  getStats: (adminKey: string) =>
    api.get('/admin/stats', { headers: { 'X-Admin-Key': adminKey } }),
  getUsers: (adminKey: string, params: { search?: string; limit?: number; offset?: number }) =>
    api.get('/admin/users', { params, headers: { 'X-Admin-Key': adminKey } }),
  getFeedback: (adminKey: string, params: { resolved?: boolean; type?: string; limit?: number; offset?: number }) =>
    api.get('/admin/feedback', { params, headers: { 'X-Admin-Key': adminKey } }),
  resolveFeedback: (adminKey: string, id: string) =>
    api.put(`/admin/feedback/${id}/resolve`, {}, { headers: { 'X-Admin-Key': adminKey } }),
  refreshLeaderboard: (adminKey: string) =>
    api.post('/admin/refresh-leaderboard', {}, { headers: { 'X-Admin-Key': adminKey } }),
};

export default api;