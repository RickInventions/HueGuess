import { config } from 'dotenv';
config();

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
} as const;

// Validate required env vars
if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}