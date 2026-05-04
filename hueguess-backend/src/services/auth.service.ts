import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, getClient } from '../config/db.js';
import { EmailService } from './email.service.js';
import type { User, AuthPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export class AuthService {
  // Register — no token returned, just creates + sends verification
  static async register(username: string, email: string, password: string): Promise<{ message: string }> {
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username]
    );

    if (existingUser.rows.length > 0) {
      const emailCheck = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (emailCheck.rows.length > 0) {
        throw new Error('Email already registered');
      }
      throw new Error('Username already taken');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    
    const result = await query(
      `INSERT INTO users (username, email, password_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, email, is_verified, created_at`,
      [username, email.toLowerCase(), passwordHash]
    );

    const user = result.rows[0];

    // Generate verification code and send email
    const verificationCode = EmailService.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await query(
      `INSERT INTO email_verification_tokens (user_id, code, expires_at) 
       VALUES ($1, $2, $3)`,
      [user.id, verificationCode, expiresAt]
    );

    // Fire and forget email sending
    EmailService.sendVerificationEmail(email, verificationCode, username).catch(err => {
      console.error('Failed to send verification email:', err);
    });

    return { message: 'Registration successful. Please check your email for the verification code.' };
  }

  // Login — only verified users get a token
  static async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const result = await query(
      'SELECT id, username, email, password_hash, is_verified, created_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const userRow = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, userRow.password_hash);

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    if (!userRow.is_verified) {
      throw new Error('Email not verified. Please check your email for the verification code.');
    }

    const user: User = {
      id: userRow.id,
      username: userRow.username,
      email: userRow.email,
      is_verified: userRow.is_verified,
      created_at: userRow.created_at,
    };

    const token = AuthService.generateToken({ userId: user.id, username: user.username });

    return { user, token };
  }

  // Verify email
  static async verifyEmail(email: string, code: string): Promise<{ message: string }> {
    const userResult = await query('SELECT id, username FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const userId = userResult.rows[0].id;

    const tokenResult = await query(
      `SELECT id FROM email_verification_tokens 
       WHERE user_id = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, code]
    );

    if (tokenResult.rows.length === 0) {
      throw new Error('Invalid or expired verification code');
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');
      
      await client.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [userId]);
      await client.query(
        'UPDATE email_verification_tokens SET used = TRUE WHERE id = $1',
        [tokenResult.rows[0].id]
      );
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return { message: 'Email verified successfully. You can now login.' };
  }

  // Resend verification code
  static async resendVerification(email: string): Promise<{ message: string }> {
    const userResult = await query(
      'SELECT id, username, is_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (userResult.rows.length === 0) {
      // Don't reveal if user exists — still send success message
      return { message: 'If an account exists with this email, a new verification code has been sent.' };
    }

    const user = userResult.rows[0];

    if (user.is_verified) {
      return { message: 'Email is already verified. You can login.' };
    }

    // Invalidate old codes for this user
    await query(
      'UPDATE email_verification_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE',
      [user.id]
    );

    const verificationCode = EmailService.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await query(
      `INSERT INTO email_verification_tokens (user_id, code, expires_at) 
       VALUES ($1, $2, $3)`,
      [user.id, verificationCode, expiresAt]
    );

    EmailService.sendVerificationEmail(email, verificationCode, user.username).catch(err => {
      console.error('Failed to send verification email:', err);
    });

    return { message: 'If an account exists with this email, a new verification code has been sent.' };
  }

  // Get current user
  static async getMe(userId: string): Promise<User> {
    const result = await query(
      'SELECT id, username, email, is_verified, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  }

  static generateToken(payload: AuthPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
  }

  static verifyToken(token: string): AuthPayload {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  }
}