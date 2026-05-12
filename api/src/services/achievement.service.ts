import pool from '../config/db.js';

export interface Achievement {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requirement_type: string;
  requirement_value: number;
  requirement_metadata: any;
}

export interface UserStatsForAchievements {
  userId: string;
  currentRating: number;
  currentStreak: number;
  totalGames: number;
  bestAccuracy: number;
  gamesByDifficulty: Map<string, number>;
  multiplayerWins?: number;
  multiplayerGames?: number;
}

export class AchievementService {
  
  // Get all achievements
  static async getAllAchievements(): Promise<Achievement[]> {
    const result = await pool.query(
      `SELECT key, name, description, category, icon, requirement_type, requirement_value, requirement_metadata
       FROM achievements
       ORDER BY 
         CASE category
           WHEN 'accuracy' THEN 1
           WHEN 'streak' THEN 2
           WHEN 'games' THEN 3
           WHEN 'elo' THEN 4
           WHEN 'modes' THEN 5
           WHEN 'multiplayer' THEN 6
         END,
         requirement_value ASC`
    );
    
    return result.rows;
  }
  
  // Get user's unlocked achievements
  static async getUserAchievements(userId: string): Promise<{
    unlocked: Achievement[];
    locked: (Achievement & { progress_current: number; progress_target: number })[];
  }> {
    // Get all achievements
    const allAchievements = await this.getAllAchievements();
    
    // Get unlocked keys
    const unlockedResult = await pool.query(
      `SELECT achievement_key, unlocked_at
       FROM user_achievements
       WHERE user_id = $1`,
      [userId]
    );
    
    const unlockedKeys = new Set(unlockedResult.rows.map((r: any) => r.achievement_key));
    const unlockedAchievements = allAchievements.filter(a => unlockedKeys.has(a.key));
    
    // Get user stats for progress calculation
    const stats = await this.getUserStatsForProgress(userId);
    
    // Build locked achievements with progress
    const lockedAchievements = [];
    for (const ach of allAchievements) {
      if (!unlockedKeys.has(ach.key)) {
        const progress = await this.getAchievementProgress(userId, ach, stats);
        lockedAchievements.push({
          ...ach,
          progress_current: progress.current,
          progress_target: progress.target,
        });
      }
    }
    
    return {
      unlocked: unlockedAchievements,
      locked: lockedAchievements,
    };
  }
  
  // Check and unlock achievements after a game
  static async checkAndUnlockAchievements(
    userId: string,
    gameData: {
      accuracy: number;
      difficulty: string;
      mode: string;
      ratingAfter?: number;
      streakAfter?: number;
    }
  ): Promise<Achievement[]> {
    const newlyUnlocked: Achievement[] = [];
    
    // Get user's current stats
    const stats = await this.getUserStatsForProgress(userId);
    
    // Update stats with new game data
    stats.currentRating = gameData.ratingAfter || stats.currentRating;
    stats.currentStreak = gameData.streakAfter || stats.currentStreak;
    if (gameData.accuracy > stats.bestAccuracy) {
      stats.bestAccuracy = gameData.accuracy;
    }
    
    // Increment game count for this difficulty
    const currentCount = stats.gamesByDifficulty.get(gameData.difficulty) || 0;
    stats.gamesByDifficulty.set(gameData.difficulty, currentCount + 1);
    stats.totalGames++;
    
    // Check each achievement type
    const allAchievements = await this.getAllAchievements();
    
    for (const achievement of allAchievements) {
      // Skip if already unlocked
      const isUnlocked = await this.isAchievementUnlocked(userId, achievement.key);
      if (isUnlocked) continue;
      
      let shouldUnlock = false;
      
      switch (achievement.requirement_type) {
        case 'accuracy_gt':
          if (gameData.accuracy >= achievement.requirement_value) {
            shouldUnlock = true;
          }
          break;
          
        case 'streak_gt':
          if (stats.currentStreak >= achievement.requirement_value) {
            shouldUnlock = true;
          }
          break;
          
        case 'games_gt':
          if (stats.totalGames >= achievement.requirement_value) {
            shouldUnlock = true;
          }
          break;
          
        case 'rating_gt':
          if (stats.currentRating >= achievement.requirement_value) {
            shouldUnlock = true;
          }
          break;
          
        case 'difficulty_completed':
          if (achievement.requirement_metadata?.difficulty === gameData.difficulty) {
            shouldUnlock = true;
          }
          break;
          
        case 'difficulty_completed_gt':
          const gamesOnDifficulty = stats.gamesByDifficulty.get(achievement.requirement_metadata?.difficulty) || 0;
          if (gamesOnDifficulty >= achievement.requirement_value) {
            shouldUnlock = true;
          }
          break;
          
        case 'multiplayer_wins':
          if (stats.multiplayerWins && stats.multiplayerWins >= achievement.requirement_value) {
            shouldUnlock = true;
          }
          break;
          
        case 'multiplayer_games':
          if (stats.multiplayerGames && stats.multiplayerGames >= achievement.requirement_value) {
            shouldUnlock = true;
          }
          break;
      }
      
      if (shouldUnlock) {
        await this.unlockAchievement(userId, achievement.key);
        newlyUnlocked.push(achievement);
      }
    }
    
    return newlyUnlocked;
  }
  
  // Unlock a specific achievement
  static async unlockAchievement(userId: string, achievementKey: string): Promise<void> {
    await pool.query(
      `INSERT INTO user_achievements (user_id, achievement_key, unlocked_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, achievement_key) DO NOTHING`,
      [userId, achievementKey]
    );
  }
  
  // Check if achievement is unlocked
  static async isAchievementUnlocked(userId: string, achievementKey: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT id FROM user_achievements
       WHERE user_id = $1 AND achievement_key = $2`,
      [userId, achievementKey]
    );
    
    return result.rows.length > 0;
  }
  
  // Get user stats for progress calculation
  private static async getUserStatsForProgress(userId: string): Promise<UserStatsForAchievements> {
    // Get competitive stats
    const statsResult = await pool.query(
      `SELECT rating, current_streak, games_played, best_score as best_accuracy
       FROM competitive_stats
       WHERE user_id = $1`,
      [userId]
    );
    
    // Get games by difficulty
    const difficultyResult = await pool.query(
      `SELECT difficulty, COUNT(*) as count
       FROM game_rounds
       WHERE user_id = $1 AND mode = 'competitive' AND accuracy IS NOT NULL
       GROUP BY difficulty`,
      [userId]
    );
    
    const gamesByDifficulty = new Map<string, number>();
    for (const row of difficultyResult.rows) {
      gamesByDifficulty.set(row.difficulty, parseInt(row.count));
    }
    
    // Get best accuracy from all games
    const bestAccuracyResult = await pool.query(
      `SELECT MAX(accuracy) as best
       FROM game_rounds
       WHERE user_id = $1 AND mode = 'competitive' AND accuracy IS NOT NULL`,
      [userId]
    );
    
    const stats = statsResult.rows[0] || {
      rating: 100,
      current_streak: 0,
      games_played: 0,
      best_accuracy: 0,
    };
    
    return {
      userId,
      currentRating: stats.rating,
      currentStreak: stats.current_streak,
      totalGames: stats.games_played,
      bestAccuracy: stats.best_accuracy || bestAccuracyResult.rows[0]?.best || 0,
      gamesByDifficulty,
      multiplayerWins: 0, // Will be updated in Phase 7
      multiplayerGames: 0, // Will be updated in Phase 7
    };
  }
  
  // Get progress for a specific achievement
  private static async getAchievementProgress(
    userId: string,
    achievement: Achievement,
    stats: UserStatsForAchievements
  ): Promise<{ current: number; target: number }> {
    let current = 0;
    const target = achievement.requirement_value;
    
    switch (achievement.requirement_type) {
      case 'accuracy_gt':
        current = Math.min(stats.bestAccuracy, target);
        break;
        
      case 'streak_gt':
        current = Math.min(stats.currentStreak, target);
        break;
        
      case 'games_gt':
        current = Math.min(stats.totalGames, target);
        break;
        
      case 'rating_gt':
        current = Math.min(stats.currentRating, target);
        break;
        
      case 'difficulty_completed_gt':
        const gamesOnDifficulty = stats.gamesByDifficulty.get(achievement.requirement_metadata?.difficulty) || 0;
        current = Math.min(gamesOnDifficulty, target);
        break;
        
      default:
        current = 0;
    }
    
    return { current, target };
  }
  
  // Get recent unlocked achievements (for notifications)
  static async getRecentUnlocked(userId: string, limit: number = 5): Promise<any[]> {
    const result = await pool.query(
      `SELECT ua.unlocked_at, a.key, a.name, a.description, a.icon, a.category
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_key = a.key
       WHERE ua.user_id = $1
       ORDER BY ua.unlocked_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    
    return result.rows;
  }
  
  // Get achievement count by category for a user
  static async getAchievementStats(userId: string): Promise<{
    total: number;
    byCategory: Record<string, number>;
    totalPossible: number;
  }> {
    const totalPossibleResult = await pool.query(
      `SELECT COUNT(*) as count FROM achievements`
    );
    
    const unlockedResult = await pool.query(
      `SELECT COUNT(*) as count, a.category
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_key = a.key
       WHERE ua.user_id = $1
       GROUP BY a.category`,
      [userId]
    );
    
    const byCategory: Record<string, number> = {};
    for (const row of unlockedResult.rows) {
      byCategory[row.category] = parseInt(row.count);
    }
    
    const totalUnlockedResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM user_achievements
       WHERE user_id = $1`,
      [userId]
    );
    
    return {
      total: parseInt(totalUnlockedResult.rows[0].count),
      byCategory,
      totalPossible: parseInt(totalPossibleResult.rows[0].count),
    };
  }
}