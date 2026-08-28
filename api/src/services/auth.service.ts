import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import jwt from 'jsonwebtoken';  
import { EmailService } from './email.service.js';
import { RegisterInput, LoginInput } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '7d';

/**
 * Canonical form of an address, for both storing and looking up.
 *
 * Mailbox names are case-sensitive per the RFC but no real provider treats them
 * that way, and a person who signed up as Oatman@gmail.com will type
 * oatman@gmail.com next week and expect to get in. Lookups additionally compare
 * with LOWER(email) so rows written before this existed still match.
 */
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export class AuthService {
  static async register({ username, email, password }: RegisterInput) {
    const normalizedEmail = normalizeEmail(email);

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1 OR LOWER(username) = LOWER($2)',
      [normalizedEmail, username]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User with this email or username already exists');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, is_verified, created_at`,
      [username, normalizedEmail, password_hash]
    );

    const user = result.rows[0];

    // Create verification token and code
    const token = EmailService.generateToken();
    const code = EmailService.generateVerificationCode();
    const expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 24); // 24 hours

    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, token, code, expires_at]
    );

    // Send verification email
    await EmailService.sendVerificationEmail(normalizedEmail, token, code, username);

    // Return user WITHOUT token (only login gives token)
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_verified: user.is_verified,
        created_at: user.created_at,
      },
      message: 'Registration successful. Please verify your email to login.'
    };
  }

  static async login({ email, password }: LoginInput) {
    const result = await pool.query(
      `SELECT id, username, email, password_hash, is_verified
       FROM users WHERE LOWER(email) = $1`,
      [normalizeEmail(email)]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = result.rows[0];


    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Refuse the token rather than issuing one that says isVerified: false — a
    // seven-day token minted here used to outlive the verification itself, and
    // the holder kept being told to verify an address the database had already
    // confirmed. The code is tagged so the client can route to code entry
    // instead of showing a dead end.
    if (!user.is_verified) {
      const error = new Error('Please verify your email before logging in') as Error & {
        code?: string;
        email?: string;
      };
      error.code = 'EMAIL_NOT_VERIFIED';
      error.email = user.email;
      throw error;
    }

    // Generate JWT only on successful login
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      isVerified: user.is_verified,
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_verified: user.is_verified,
      },
      token,
    };
  }

  /**
   * Current verification state, straight from the database.
   *
   * Every gate must call this instead of reading the JWT's `isVerified` claim:
   * the claim is a snapshot from login time and goes stale the moment somebody
   * verifies, which is exactly the window new users were getting stuck in.
   */
  static async isVerified(userId: string): Promise<boolean> {
    const result = await pool.query('SELECT is_verified FROM users WHERE id = $1', [userId]);
    return result.rows[0]?.is_verified === true;
  }

  /** Log the user in off the back of a successful verification. */
  private static async issueSessionFor(userId: string) {
    const result = await pool.query(
      'SELECT id, username, email, is_verified FROM users WHERE id = $1',
      [userId]
    );
    const user = result.rows[0];
    if (!user) throw new Error('Account no longer exists');

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_verified: user.is_verified,
      },
      token: this.generateToken({
        userId: user.id,
        email: user.email,
        username: user.username,
        isVerified: user.is_verified,
      }),
    };
  }

  static async verifyEmail(token: string, email: string) {
    return this.consumeVerification('token', token, email);
  }

  static async verifyWithCode(email: string, code: string) {
    return this.consumeVerification('code', code, email);
  }

  /**
   * Redeem a verification link or code, and hand back a session.
   *
   * Three deliberate choices, each fixing a way the old flow stranded people:
   *
   * - It returns a token, so verifying logs you in. Previously it returned only
   *   a success message and the client had to send you back to log in again.
   * - Already-verified is a success, not an error. Clicking the link twice, or
   *   entering the code after the link already worked, used to answer "Invalid
   *   or expired" — which reads as broken when the account is in fact fine.
   * - It matches the address case-insensitively, so the address in the link's
   *   query string doesn't have to match the stored capitalisation.
   */
  private static async consumeVerification(
    kind: 'token' | 'code',
    value: string,
    email: string
  ) {
    const normalizedEmail = normalizeEmail(email);
    const column = kind === 'token' ? 'vt.token' : 'vt.code';

    const result = await pool.query(
      `SELECT vt.id, vt.user_id, vt.expires_at, vt.used, u.is_verified
       FROM email_verification_tokens vt
       JOIN users u ON vt.user_id = u.id
       WHERE ${column} = $1 AND LOWER(u.email) = $2
       ORDER BY vt.expires_at DESC
       LIMIT 1`,
      [value, normalizedEmail]
    );

    // No matching row at all — but if the address is already verified, the row was
    // simply cleaned up after a successful verification. That is a success.
    if (result.rows.length === 0) {
      const existing = await pool.query(
        'SELECT id, is_verified FROM users WHERE LOWER(email) = $1',
        [normalizedEmail]
      );
      if (existing.rows[0]?.is_verified) {
        return { success: true, message: 'Email already verified', ...(await this.issueSessionFor(existing.rows[0].id)) };
      }
      throw new Error(
        kind === 'token'
          ? 'Invalid or expired verification link'
          : 'Invalid or expired verification code'
      );
    }

    const verification = result.rows[0];

    // Already done — hand over the session rather than an error.
    if (verification.is_verified) {
      return {
        success: true,
        message: 'Email already verified',
        ...(await this.issueSessionFor(verification.user_id)),
      };
    }

    if (new Date() > verification.expires_at) {
      // Delete expired unverified user
      await pool.query(`DELETE FROM users WHERE id = $1 AND is_verified = false`, [
        verification.user_id,
      ]);
      throw new Error(
        kind === 'token'
          ? 'Verification link has expired. Please register again.'
          : 'Verification code has expired. Please register again.'
      );
    }

    await pool.query('BEGIN');
    try {
      await pool.query(`UPDATE email_verification_tokens SET used = true WHERE id = $1`, [
        verification.id,
      ]);
      await pool.query(`UPDATE users SET is_verified = true WHERE id = $1`, [
        verification.user_id,
      ]);
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

    // Drop the rest of this user's unused tokens.
    await pool.query(
      `DELETE FROM email_verification_tokens WHERE user_id = $1 AND used = false`,
      [verification.user_id]
    );

    return {
      success: true,
      message: 'Email verified successfully',
      ...(await this.issueSessionFor(verification.user_id)),
    };
  }

  static async resendVerification(email: string) {
    const userResult = await pool.query(
      'SELECT id, username, email, is_verified FROM users WHERE LOWER(email) = $1',
      [normalizeEmail(email)]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    if (user.is_verified) {
      throw new Error('Email already verified');
    }

    // Check if user is expired (older than 24 hours)
    const userAge = await pool.query(
      'SELECT created_at FROM users WHERE id = $1',
      [user.id]
    );
    
    const createdAt = userAge.rows[0].created_at;
    const hoursOld = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    
    if (hoursOld >= 24) {
      // Delete expired unverified user
      await pool.query(
        `DELETE FROM users WHERE id = $1 AND is_verified = false`,
        [user.id]
      );
      throw new Error('Verification period expired. Please register again.');
    }

    // Invalidate old tokens
    await pool.query(
      `UPDATE email_verification_tokens SET used = true WHERE user_id = $1 AND used = false`,
      [user.id]
    );

    // Create new token
    const token = EmailService.generateToken();
    const code = EmailService.generateVerificationCode();
    const expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 24);

    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, token, code, expires_at]
    );

    await EmailService.sendVerificationEmail(email, token, code, user.username);

    return { success: true, message: 'Verification email resent' };
  }

  static async forgotPassword(email: string) {
    const userResult = await pool.query(
      'SELECT id, username, email, is_verified FROM users WHERE LOWER(email) = $1',
      [normalizeEmail(email)]
    );

    if (userResult.rows.length === 0) {
      // Don't reveal if user exists for security
      return { success: true, message: 'If an account exists, a reset link will be sent' };
    }

    const user = userResult.rows[0];
    
    // Only allow password reset for verified users
    if (!user.is_verified) {
      return { success: true, message: 'If an account exists, a reset link will be sent' };
    }

    // Invalidate old tokens
    await pool.query(
      `UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false`,
      [user.id]
    );

    const token = EmailService.generateToken();
    const expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 1); // 1 hour

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, expires_at]
    );

    await EmailService.sendPasswordResetEmail(email, token, user.username);

    return { success: true, message: 'If an account exists, a reset link will be sent' };
  }

  static async resetPassword(token: string, email: string, newPassword: string) {
    const result = await pool.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used, u.email, u.is_verified
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = $1 AND LOWER(u.email) = $2 AND prt.used = false`,
      [token, normalizeEmail(email)]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired reset link');
    }

    const resetToken = result.rows[0];
    
    // Only allow password reset for verified users
    if (!resetToken.is_verified) {
      throw new Error('Cannot reset password for unverified account');
    }

    if (new Date() > resetToken.expires_at) {
      throw new Error('Reset link has expired');
    }

    const password_hash = await bcrypt.hash(newPassword, 10);

    await pool.query('BEGIN');
    try {
      await pool.query(
        `UPDATE password_reset_tokens SET used = true WHERE id = $1`,
        [resetToken.id]
      );
      
      await pool.query(
        `UPDATE users SET password_hash = $1 WHERE id = $2`,
        [password_hash, resetToken.user_id]
      );
      
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

    return { success: true, message: 'Password reset successfully' };
  }

  static async getMe(userId: string) {
    const result = await pool.query(
      `SELECT id, username, email, is_verified, created_at, last_username_change
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  }

  // Clean up expired unverified users (call this periodically)
  static async cleanupExpiredUsers() {
    const result = await pool.query(
      `DELETE FROM users 
       WHERE is_verified = false 
         AND created_at < NOW() - INTERVAL '24 hours'
         AND NOT EXISTS (
           SELECT 1 FROM email_verification_tokens 
           WHERE user_id = users.id 
             AND expires_at > NOW() 
             AND used = false
         )
       RETURNING id, username, email`
    );
    
    console.log(`🧹 Cleaned up ${result.rows.length} expired unverified users`);
    return result.rows;
  }

  private static generateToken(payload: any): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }
}