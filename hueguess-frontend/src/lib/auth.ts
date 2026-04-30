/* eslint-disable @typescript-eslint/no-explicit-any */
import api from './api';

export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const response = await api.post('/auth/register', { username, email, password }) as any;
  return response.data;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const response = await api.post('/auth/login', { email, password }) as any;
  return response.data;
}

export async function getMe(): Promise<User> {
  const response = await api.get('/auth/me') as any;
  return response.data;
}