import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import { CompetitiveService } from './competitive.service.js';
import { AchievementService } from './achievement.service.js';

export class UserService {
  
  static async getPublicProfile(username: string) {
    // Get user basic info
    const userResult = await pool.query(
      `SELECT id, username, created_at
       FROM users
       WHERE username = $1`,
      [username]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = userResult.rows[0];
    
    // Get competitive stats (limited to essential public info)
    const statsResult = await pool.query(
      `SELECT rating, rank_tier, games_played, avg_accuracy, best_streak
       FROM competitive_stats
       WHERE user_id = $1`,
      [user.id]
    );
    
    const stats = statsResult.rows[0] || {
      rating: 100,
      rank_tier: 'Bronze',
      games_played: 0,
      avg_accuracy: 0,
      best_streak: 0,
    };
    
    // Get unlocked achievements ONLY (public can see what they've earned)
    const unlockedAchievements = await pool.query(
      `SELECT a.key, a.name, a.description, a.icon, a.category, ua.unlocked_at
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_key = a.key
       WHERE ua.user_id = $1
       ORDER BY ua.unlocked_at DESC`,
      [user.id]
    );
    
    // Get total achievement count
    const totalAchievements = await pool.query(
      `SELECT COUNT(*) as count
       FROM user_achievements
       WHERE user_id = $1`,
      [user.id]
    );
    
    return {
      user: {
        username: user.username,
        joinedDate: user.created_at,
      },
      stats: {
        rating: stats.rating,
        rankTier: stats.rank_tier,
        gamesPlayed: stats.games_played,
        avgAccuracy: Math.round(stats.avg_accuracy * 100) / 100,
        bestStreak: stats.best_streak,
      },
      achievements: {
        unlocked: unlockedAchievements.rows,
        totalUnlocked: parseInt(totalAchievements.rows[0].count),
      },
    };
  }
  
  // Get own profile (FULL DETAILS - private)
  static async getOwnProfile(userId: string) {
    // Get user basic info
    const userResult = await pool.query(
      `SELECT id, username, email, created_at, is_verified, last_username_change
       FROM users
       WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = userResult.rows[0];
    
    // Get competitive stats (full)
    const stats = await CompetitiveService.getUserStats(user.id);
    
    // Get achievements (unlocked + locked with progress)
    const achievements = await AchievementService.getUserAchievements(user.id);
    
    // Get recent games (last 10)
    const recentGames = await pool.query(
      `SELECT id, difficulty, accuracy, memorization_seconds, created_at, is_reload
       FROM game_rounds
       WHERE user_id = $1 AND mode = 'competitive' AND accuracy IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 10`,
      [user.id]
    );
    
    // Get rating history for chart (last 50 entries)
    const ratingHistory = await pool.query(
      `SELECT created_at, rating_after as rating
       FROM rating_history
       WHERE user_id = $1
       ORDER BY created_at ASC
       LIMIT 50`,
      [user.id]
    );
    
    // Get total games by difficulty
    const gamesByDifficulty = await pool.query(
      `SELECT difficulty, COUNT(*) as count
       FROM game_rounds
       WHERE user_id = $1 AND mode = 'competitive' AND accuracy IS NOT NULL
       GROUP BY difficulty`,
      [user.id]
    );
    
    // Check username change eligibility
    const canChangeUsername = this.canChangeUsername(user.last_username_change);
    const achievementStats = await AchievementService.getAchievementStats(user.id);
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        joinedDate: user.created_at,
        isVerified: user.is_verified,
        lastUsernameChange: user.last_username_change,
        canChangeUsername,
        nextUsernameChangeDate: canChangeUsername ? null : this.getNextUsernameChangeDate(user.last_username_change),
      },
      stats: {
        rating: stats.rating,
        rankTier: stats.rank_tier,
        rankProgress: stats.rankProgress,
        gamesPlayed: stats.games_played,
        avgAccuracy: Math.round(stats.avg_accuracy * 100) / 100,
        bestScore: stats.best_score,
        currentStreak: stats.current_streak,
        bestStreak: stats.best_streak,
        lastGameAt: stats.last_game_at,
      },
      achievements: {
        unlocked: achievements.unlocked,
        locked: achievements.locked,
        totalUnlocked: achievements.unlocked.length,
        totalPossible: 17,
        stats: achievementStats,
      },
      gamesByDifficulty: gamesByDifficulty.rows,
      recentGames: recentGames.rows.map((game: any) => ({
        id: game.id,
        difficulty: game.difficulty,
        accuracy: Math.round(game.accuracy * 100) / 100,
        memorizationSeconds: game.memorization_seconds,
        createdAt: game.created_at,
        isReload: game.is_reload,
      })),
      ratingHistory: ratingHistory.rows.map((point: any) => ({
        date: point.created_at,
        rating: point.rating,
      })),
    };
  }
  
  // Get minimal user info for leaderboard/mentions
  static async getMinimalUserInfo(userId: string) {
    const result = await pool.query(
      `SELECT id, username
       FROM users
       WHERE id = $1`,
      [userId]
    );
    
    return result.rows[0] || null;
  }
  
  
  // Get public profile by user ID (internal)
  static async getPublicProfileByUserId(userId: string) {
    // Get user basic info
    const userResult = await pool.query(
      `SELECT id, username, created_at, is_verified
       FROM users
       WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = userResult.rows[0];
    
    // Get competitive stats
    const stats = await CompetitiveService.getUserStats(user.id);
    
    // Get achievements (unlocked only for public profile)
    const achievements = await AchievementService.getUserAchievements(user.id);
    
    // Get recent games (last 10)
    const recentGames = await pool.query(
      `SELECT id, difficulty, accuracy, memorization_seconds, created_at, is_reload
       FROM game_rounds
       WHERE user_id = $1 AND mode = 'competitive' AND accuracy IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 10`,
      [user.id]
    );
    
    // Get rating history for chart (last 50 entries)
    const ratingHistory = await pool.query(
      `SELECT created_at, rating_after as rating
       FROM rating_history
       WHERE user_id = $1
       ORDER BY created_at ASC
       LIMIT 50`,
      [user.id]
    );
    
    // Get total games by difficulty
    const gamesByDifficulty = await pool.query(
      `SELECT difficulty, COUNT(*) as count
       FROM game_rounds
       WHERE user_id = $1 AND mode = 'competitive' AND accuracy IS NOT NULL
       GROUP BY difficulty`,
      [user.id]
    );
    
    return {
      user: {
        id: user.id,
        username: user.username,
        joinedDate: user.created_at,
        isVerified: user.is_verified,
      },
      stats: {
        rating: stats.rating,
        rankTier: stats.rank_tier,
        rankProgress: stats.rankProgress,
        gamesPlayed: stats.games_played,
        avgAccuracy: Math.round(stats.avg_accuracy * 100) / 100,
        bestScore: stats.best_score,
        currentStreak: stats.current_streak,
        bestStreak: stats.best_streak,
        lastGameAt: stats.last_game_at,
      },
      achievements: {
        unlocked: achievements.unlocked,
        totalUnlocked: achievements.unlocked.length,
        totalPossible: 17,
        stats: await AchievementService.getAchievementStats(user.id),
      },
      gamesByDifficulty: gamesByDifficulty.rows,
      recentGames: recentGames.rows.map((game: any) => ({
        id: game.id,
        difficulty: game.difficulty,
        accuracy: Math.round(game.accuracy * 100) / 100,
        memorizationSeconds: game.memorization_seconds,
        createdAt: game.created_at,
        isReload: game.is_reload,
      })),
      ratingHistory: ratingHistory.rows.map((point: any) => ({
        date: point.created_at,
        rating: point.rating,
      })),
    };
  }
  
  // Change username (2-day cooldown)
  static async changeUsername(userId: string, newUsername: string) {
    // Check if username is taken
    const existingResult = await pool.query(
      `SELECT id FROM users WHERE username = $1 AND id != $2`,
      [newUsername, userId]
    );
    
    if (existingResult.rows.length > 0) {
      throw new Error('Username already taken');
    }
    
    // Check cooldown
    const userResult = await pool.query(
      `SELECT last_username_change FROM users WHERE id = $1`,
      [userId]
    );
    
    const user = userResult.rows[0];
    
    if (!this.canChangeUsername(user.last_username_change)) {
      const nextChangeDate = this.getNextUsernameChangeDate(user.last_username_change);
      throw new Error(`Username can only be changed once every 2 days. Next change available: ${nextChangeDate}`);
    }
    
    // Update username
    await pool.query(
      `UPDATE users 
       SET username = $1, last_username_change = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [newUsername, userId]
    );
    
    return { success: true, username: newUsername };
  }
  
  // Change password
  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // Get current password hash
    const userResult = await pool.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [userId]
    );
    
    const user = userResult.rows[0];
    
    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }
    
    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, userId]
    );
    
    return { success: true, message: 'Password changed successfully' };
  }
  
  // Search users (for inspect player)
  static async searchUsers(searchTerm: string, limit: number = 10) {
    const result = await pool.query(
      `SELECT id, username, 
         (SELECT rating FROM competitive_stats WHERE user_id = users.id) as rating
       FROM users
       WHERE username ILIKE $1
       ORDER BY username
       LIMIT $2`,
      [`%${searchTerm}%`, limit]
    );
    
    return result.rows;
  }
  
  // Helper: Check if user can change username
  private static canChangeUsername(lastChangeDate: Date | null): boolean {
    if (!lastChangeDate) return true;
    
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const lastChange = new Date(lastChangeDate);
    
    return now.getTime() - lastChange.getTime() >= twoDaysInMs;
  }
  
  // Helper: Get next username change date
  private static getNextUsernameChangeDate(lastChangeDate: Date | null): string | null {
    if (!lastChangeDate) return null;
    
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    const nextChange = new Date(new Date(lastChangeDate).getTime() + twoDaysInMs);
    
    return nextChange.toISOString();
  }
}