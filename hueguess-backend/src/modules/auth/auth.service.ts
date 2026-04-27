import { sql } from '../db/connection.js';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import type { User, AuthTokens } from './auth.types.js';

// ENV (safe defaults + correct typing)
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'access-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'refresh-secret-change-me';

const ACCESS_TOKEN_EXPIRY = (process.env.ACCESS_TOKEN_EXPIRY ?? '1d') as SignOptions['expiresIn'];
const REFRESH_TOKEN_EXPIRY = (process.env.REFRESH_TOKEN_EXPIRY ?? '7d') as SignOptions['expiresIn'];

export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<{ user: User; tokens: AuthTokens }> {

  const existingUsers = await sql`
    SELECT id FROM users 
    WHERE email = ${email} OR username = ${username}
  `;

  if (existingUsers.length > 0) {
    throw new Error('User with this email or username already exists');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await sql`
    INSERT INTO users (username, email, password_hash)
    VALUES (${username}, ${email}, ${passwordHash})
    RETURNING id, username, email, created_at
  `;

  const row = result[0];

  const user: User = {
    id: row.id,
    username: row.username,
    email: row.email,
    created_at: row.created_at,
  };

  const tokens = generateTokens(user.id);

  return { user, tokens };
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ user: User; tokens: AuthTokens }> {

  const users = await sql`
    SELECT id, username, email, password_hash, created_at
    FROM users
    WHERE email = ${email}
  `;

  if (users.length === 0) {
    throw new Error('Invalid email or password');
  }

  const dbUser = users[0];

  const isValidPassword = await bcrypt.compare(password, dbUser.password_hash);

  if (!isValidPassword) {
    throw new Error('Invalid email or password');
  }

  const user: User = {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    created_at: dbUser.created_at,
  };

  const tokens = generateTokens(user.id);

  return { user, tokens };
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };

    const users = await sql`
      SELECT id FROM users WHERE id = ${payload.userId}
    `;

    if (users.length === 0) {
      throw new Error('User not found');
    }

    return generateTokens(payload.userId);
  } catch {
    throw new Error('Invalid refresh token');
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  const users = await sql`
    SELECT id, username, email, created_at
    FROM users
    WHERE id = ${userId}
  `;

  if (users.length === 0) return null;

  const row = users[0];

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    created_at: row.created_at,
  };
}

function generateTokens(userId: string): AuthTokens {
  const accessToken = jwt.sign(
    { userId },
    JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
}