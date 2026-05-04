import { API_BASE } from './constants'
import type { ApiError } from '../types'

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

function getToken(): string | null {
  return localStorage.getItem('hueguess_token')
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  // Handle 401 — token expired
  if (response.status === 401 && token) {
    localStorage.removeItem('hueguess_token')
    onUnauthorized?.()
    throw new Error('Session expired. Please log in again.')
  }

  const data = await response.json()

  if (!response.ok) {
    const error = data as ApiError
    throw new Error(error.message || error.error || 'Something went wrong')
  }

  return data as T
}

// ─── Auth ───────────────────────────────
export const api = {
  // Auth
  register: (payload: { username: string; email: string; password: string }) =>
    request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyEmail: (payload: { email: string; code: string }) =>
    request<{ message: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: () => request<{ user: any }>('/auth/me'),

  // Game
  createRound: (mode: string, difficulty?: string) => {
    const params = new URLSearchParams({ mode })
    if (difficulty) params.set('difficulty', difficulty)
    return request<any>(`/game/round?${params}`, { method: 'POST' })
  },

  submitRound: (roundId: string, userColor: { h: number; s: number; l: number }) =>
    request<any>('/game/submit', {
      method: 'POST',
      body: JSON.stringify({ roundId, userColor }),
    }),

  // Stats
  getStats: () => request<any>('/stats/me'),

  difficultyCheck: (difficulty: string) =>
    request<any>(`/stats/difficulty-check?difficulty=${difficulty}`),

  // Leaderboard
  getLeaderboard: (period: string, page = 1, limit = 50) =>
    request<any>(`/leaderboard?period=${period}&page=${page}&limit=${limit}`),

  getGlobalStats: () => request<any>('/leaderboard/global-stats'),
}