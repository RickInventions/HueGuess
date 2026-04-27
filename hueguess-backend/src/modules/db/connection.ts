import postgres from 'postgres';
import { env } from '../../config/env.js';

export const sql = postgres(env.DATABASE_URL, {
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});

// Test connection
try {
  await sql`SELECT 1`;
  console.log('✅ Database connected');
} catch (error) {
  console.error('❌ Database connection failed:', error);
  process.exit(1);
}