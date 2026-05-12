import pool from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const achievements = [
  // Accuracy achievements
  {
    key: 'accuracy_90',
    name: 'Color Sensei',
    description: 'Achieve 90% accuracy or higher in any competitive game',
    category: 'accuracy',
    icon: '🎯',
    requirement_type: 'accuracy_gt',
    requirement_value: 90,
    requirement_metadata: null,
  },
  {
    key: 'accuracy_95',
    name: 'Precision Master',
    description: 'Achieve 95% accuracy or higher in any competitive game',
    category: 'accuracy',
    icon: '💎',
    requirement_type: 'accuracy_gt',
    requirement_value: 95,
    requirement_metadata: null,
  },
  {
    key: 'accuracy_99',
    name: 'Pixel Perfect',
    description: 'Achieve 99% accuracy or higher in any competitive game',
    category: 'accuracy',
    icon: '🏆',
    requirement_type: 'accuracy_gt',
    requirement_value: 99,
    requirement_metadata: null,
  },
  
  // Streak achievements
  {
    key: 'streak_3',
    name: 'On Fire',
    description: 'Achieve a streak of 3 games without negative score (Hard/Extreme)',
    category: 'streak',
    icon: '🔥',
    requirement_type: 'streak_gt',
    requirement_value: 3,
    requirement_metadata: null,
  },
  {
    key: 'streak_5',
    name: 'Unstoppable',
    description: 'Achieve a streak of 5 games without negative score (Hard/Extreme)',
    category: 'streak',
    icon: '⚡',
    requirement_type: 'streak_gt',
    requirement_value: 5,
    requirement_metadata: null,
  },
  {
    key: 'streak_10',
    name: 'Godlike',
    description: 'Achieve a streak of 10 games without negative score (Hard/Extreme)',
    category: 'streak',
    icon: '👑',
    requirement_type: 'streak_gt',
    requirement_value: 10,
    requirement_metadata: null,
  },
  
  // Games played achievements
  {
    key: 'games_10',
    name: 'Getting Started',
    description: 'Play 10 competitive games',
    category: 'games',
    icon: '🎮',
    requirement_type: 'games_gt',
    requirement_value: 10,
    requirement_metadata: null,
  },
  {
    key: 'games_50',
    name: 'Dedicated Player',
    description: 'Play 50 competitive games',
    category: 'games',
    icon: '⭐',
    requirement_type: 'games_gt',
    requirement_value: 50,
    requirement_metadata: null,
  },
  {
    key: 'games_100',
    name: 'Color Veteran',
    description: 'Play 100 competitive games',
    category: 'games',
    icon: '🏅',
    requirement_type: 'games_gt',
    requirement_value: 100,
    requirement_metadata: null,
  },
  
  // ELO/Rating achievements
  {
    key: 'rating_silver',
    name: 'Silver Rank',
    description: 'Reach Silver rank (300 HuePoints)',
    category: 'elo',
    icon: '🥈',
    requirement_type: 'rating_gt',
    requirement_value: 300,
    requirement_metadata: null,
  },
  {
    key: 'rating_gold',
    name: 'Gold Rank',
    description: 'Reach Gold rank (700 HuePoints)',
    category: 'elo',
    icon: '🥇',
    requirement_type: 'rating_gt',
    requirement_value: 700,
    requirement_metadata: null,
  },
  {
    key: 'rating_platinum',
    name: 'Platinum Rank',
    description: 'Reach Platinum rank (1400 HuePoints)',
    category: 'elo',
    icon: '💠',
    requirement_type: 'rating_gt',
    requirement_value: 1400,
    requirement_metadata: null,
  },
  {
    key: 'rating_diamond',
    name: 'Diamond Rank',
    description: 'Reach Diamond rank (2500 HuePoints)',
    category: 'elo',
    icon: '💎',
    requirement_type: 'rating_gt',
    requirement_value: 2500,
    requirement_metadata: null,
  },
  
  // Mode-specific achievements
  {
    key: 'first_hard',
    name: 'Brave Soul',
    description: 'Complete your first Hard mode game',
    category: 'modes',
    icon: '😤',
    requirement_type: 'difficulty_completed',
    requirement_value: 1,
    requirement_metadata: { difficulty: 'hard' },
  },
  {
    key: 'first_extreme',
    name: 'Fearless',
    description: 'Complete your first Extreme mode game',
    category: 'modes',
    icon: '😈',
    requirement_type: 'difficulty_completed',
    requirement_value: 1,
    requirement_metadata: { difficulty: 'extreme' },
  },
  {
    key: 'hard_10',
    name: 'Hard Mode Enthusiast',
    description: 'Complete 10 Hard mode games',
    category: 'modes',
    icon: '💪',
    requirement_type: 'difficulty_completed_gt',
    requirement_value: 10,
    requirement_metadata: { difficulty: 'hard' },
  },
  
  // Multiplayer achievements (for Phase 7)
  {
    key: 'first_win',
    name: 'First Blood',
    description: 'Win your first Challenge Mode game',
    category: 'multiplayer',
    icon: '👊',
    requirement_type: 'multiplayer_wins',
    requirement_value: 1,
    requirement_metadata: null,
  },
  {
    key: 'mp_10_games',
    name: 'Social Player',
    description: 'Play 10 Challenge Mode games',
    category: 'multiplayer',
    icon: '👥',
    requirement_type: 'multiplayer_games',
    requirement_value: 10,
    requirement_metadata: null,
  },
];

async function seedAchievements() {
  try {
    console.log('🌱 Seeding achievements...');
    
    for (const ach of achievements) {
      await pool.query(
        `INSERT INTO achievements (key, name, description, category, icon, requirement_type, requirement_value, requirement_metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (key) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           category = EXCLUDED.category,
           icon = EXCLUDED.icon,
           requirement_type = EXCLUDED.requirement_type,
           requirement_value = EXCLUDED.requirement_value,
           requirement_metadata = EXCLUDED.requirement_metadata`,
        [
          ach.key,
          ach.name,
          ach.description,
          ach.category,
          ach.icon,
          ach.requirement_type,
          ach.requirement_value,
          JSON.stringify(ach.requirement_metadata),
        ]
      );
    }
    
    console.log(`✅ Seeded ${achievements.length} achievements`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed achievements:', error);
    process.exit(1);
  }
}

seedAchievements();