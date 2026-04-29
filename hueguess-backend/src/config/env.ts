import { config } from 'dotenv';
config();

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'access-secret-change-me',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-me',
  MAX_PLAYERS: parseInt(process.env.MAX_PLAYERS || '4', 10),
} as const;

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}