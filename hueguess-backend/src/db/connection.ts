import postgres from 'postgres';
import { env } from '../config/env.js';

export const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: 'require',
  transform: {
    column: { to: postgres.fromCamel, from: postgres.toCamel },
  },
});

export const testConnection = async () => {
  try {
    const result = await sql`SELECT NOW()`;
    console.log('✅ Database connected:', result[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};