import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { sql } from '../../db/connection.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { RegisterInput, LoginInput } from './auth.schema.js';

const SALT_ROUNDS = 12;

const generateTokens = (userId: string) => {
const accessToken = jwt.sign(
  { userId },
  env.JWT_SECRET,
  { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
);

const refreshToken = jwt.sign(
  { userId, type: 'refresh' },
  env.JWT_REFRESH_SECRET,
  { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
);

  return { accessToken, refreshToken };
};

export const registerUser = async (input: RegisterInput) => {
  // Check if user exists
  const existingUsers = await sql`
    SELECT id FROM users 
    WHERE email = ${input.email} OR username = ${input.username}
  `;

  if (existingUsers.length > 0) {
    const conflict = existingUsers[0].email === input.email ? 'email' : 'username';
    throw new AppError(`User with this ${conflict} already exists`, 409);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Create user
  const [user] = await sql`
    INSERT INTO users (username, email, password_hash)
    VALUES (${input.username}, ${input.email}, ${passwordHash})
    RETURNING id, username, email, created_at
  `;

  // Initialize competitive stats
  await sql`
    INSERT INTO competitive_stats (user_id)
    VALUES (${user.id})
  `;

  // Generate tokens
  const tokens = generateTokens(user.id);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    },
    ...tokens,
  };
};

export const loginUser = async (input: LoginInput) => {
  // Find user
  const [user] = await sql`
    SELECT id, username, email, password_hash, is_guest
    FROM users
    WHERE email = ${input.email}
  `;

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Verify password
  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    throw new AppError('Invalid email or password', 401);
  }

  // Generate tokens
  const tokens = generateTokens(user.id);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      isGuest: user.isGuest,
    },
    ...tokens,
  };
};

export const createGuestUser = async (username?: string) => {
  const guestUsername = username || `guest_${uuidv4().slice(0, 8)}`;
  
  // Ensure unique username
  const safeUsername = guestUsername.startsWith('guest_') 
    ? guestUsername 
    : `guest_${guestUsername}`;

  // Create guest user with dummy password (they can't login normally)
  const dummyHash = await bcrypt.hash(uuidv4(), SALT_ROUNDS);

  const [user] = await sql`
    INSERT INTO users (username, email, password_hash, is_guest)
    VALUES (
      ${safeUsername},
      ${`${safeUsername}@guest.hueguess.local`},
      ${dummyHash},
      true
    )
    RETURNING id, username, email, is_guest, created_at
  `;

  // Initialize competitive stats
  await sql`
    INSERT INTO competitive_stats (user_id)
    VALUES (${user.id})
  `;

  // Generate tokens
  const tokens = generateTokens(user.id);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      isGuest: user.isGuest,
      createdAt: user.createdAt,
    },
    ...tokens,
  };
};

export const refreshAccessToken = async (refreshToken: string) => {
  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      userId: string;
      type: string;
    };

    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid token type', 401);
    }

    // Check if user still exists
    const [user] = await sql`
      SELECT id FROM users WHERE id = ${decoded.userId}
    `;

    if (!user) {
      throw new AppError('User not found', 401);
    }

    const tokens = generateTokens(user.id);
    return tokens;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid or expired refresh token', 401);
  }
};

export const getUserById = async (userId: string) => {
  const [user] = await sql`
    SELECT id, username, email, is_guest, created_at
    FROM users
    WHERE id = ${userId}
  `;

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user;
};