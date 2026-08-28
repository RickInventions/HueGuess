import pool from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * The achievement catalogue.
 *
 * Declared as compact rows grouped into families rather than 100 hand-written
 * objects — the category, requirement type and metadata are the same across a
 * family, so repeating them 14 times per family is just somewhere for a typo to
 * hide.
 *
 * Two rules govern what is in here:
 *
 * - **Nothing depends on Challenge mode.** Challenge rooms are in-memory and
 *   vanish when the last player leaves, so there is no record to award from. The
 *   two achievements that used to reference it (`first_win`, `mp_10_games`) were
 *   hardcoded against a stat that was always 0 and could never unlock; they are
 *   deleted below rather than left as unreachable cards.
 * - **Existing keys are reused where the achievement still means the same
 *   thing.** `accuracy_90`, `streak_5`, `rating_gold` and the rest keep their
 *   keys and only change requirement_type, so nobody loses an unlock they had.
 */

type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

const POINTS: Record<Tier, number> = { bronze: 10, silver: 25, gold: 50, platinum: 100 };

interface Row {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requirement_type: string;
  requirement_value: number;
  requirement_metadata: Record<string, unknown> | null;
  tier: Tier;
  points: number;
  sort_order: number;
}

const rows: Row[] = [];

/** `[key, name, icon, value, tier, description]` */
type Entry = [string, string, string, number, Tier, string];

function family(
  category: string,
  requirement_type: string,
  entries: Entry[],
  metadata: Record<string, unknown> | null = null
) {
  for (const [key, name, icon, requirement_value, tier, description] of entries) {
    rows.push({
      key,
      name,
      description,
      category,
      icon,
      requirement_type,
      requirement_value,
      requirement_metadata: metadata,
      tier,
      points: POINTS[tier],
      sort_order: rows.length + 1,
    });
  }
}

// ── Accuracy: best single competitive round (12) ────────────────────────────
family('accuracy', 'best_accuracy', [
  ['accuracy_50', 'Warm Eyes', '👀', 50, 'bronze', 'Hit 50% accuracy in a competitive round'],
  ['accuracy_60', 'Getting Warmer', '🌡️', 60, 'bronze', 'Hit 60% accuracy in a competitive round'],
  ['accuracy_70', 'Good Eye', '🔍', 70, 'bronze', 'Hit 70% accuracy in a competitive round'],
  ['accuracy_75', 'Sharp', '✂️', 75, 'bronze', 'Hit 75% accuracy in a competitive round'],
  ['accuracy_80', 'Keen', '🦅', 80, 'silver', 'Hit 80% accuracy in a competitive round'],
  ['accuracy_85', 'Discerning', '🧐', 85, 'silver', 'Hit 85% accuracy in a competitive round'],
  ['accuracy_88', 'Calibrated', '📐', 88, 'silver', 'Hit 88% accuracy in a competitive round'],
  ['accuracy_90', 'Color Sensei', '🎯', 90, 'gold', 'Hit 90% accuracy in a competitive round'],
  ['accuracy_92', 'Spectrometer', '🌈', 92, 'gold', 'Hit 92% accuracy in a competitive round'],
  ['accuracy_95', 'Precision Master', '💎', 95, 'gold', 'Hit 95% accuracy in a competitive round'],
  ['accuracy_98', 'Near Perfect', '🪄', 98, 'platinum', 'Hit 98% accuracy in a competitive round'],
  ['accuracy_99', 'Pixel Perfect', '🏆', 99, 'platinum', 'Hit 99% accuracy in a competitive round'],
]);

// ── Accuracy: repeat performance (6) ───────────────────────────────────────
// The bar lives in metadata; requirement_value is how many rounds must clear it.
family('accuracy', 'accuracy_count', [
  ['acc80_x10', 'Consistent', '📊', 10, 'bronze', 'Clear 80% accuracy in 10 competitive rounds'],
  ['acc80_x50', 'Reliable', '🧱', 50, 'silver', 'Clear 80% accuracy in 50 competitive rounds'],
], { accuracy: 80 });

family('accuracy', 'accuracy_count', [
  ['acc90_x10', 'Repeatable Magic', '✨', 10, 'silver', 'Clear 90% accuracy in 10 competitive rounds'],
  ['acc90_x50', 'Machine Vision', '🤖', 50, 'gold', 'Clear 90% accuracy in 50 competitive rounds'],
], { accuracy: 90 });

family('accuracy', 'accuracy_count', [
  ['acc95_x10', 'Rarefied Air', '🗻', 10, 'gold', 'Clear 95% accuracy in 10 competitive rounds'],
], { accuracy: 95 });

family('accuracy', 'accuracy_count', [
  ['acc99_x25', 'Inhuman', '👁️', 25, 'platinum', 'Clear 99% accuracy in 25 competitive rounds'],
], { accuracy: 99 });

// ── Volume: competitive rounds played (12) ─────────────────────────────────
family('games', 'games_played', [
  ['games_1', 'First Light', '🌅', 1, 'bronze', 'Play your first competitive round'],
  ['games_5', 'Finding Your Feet', '👟', 5, 'bronze', 'Play 5 competitive rounds'],
  ['games_10', 'Getting Started', '🎮', 10, 'bronze', 'Play 10 competitive rounds'],
  ['games_25', 'Regular', '📅', 25, 'bronze', 'Play 25 competitive rounds'],
  ['games_50', 'Dedicated Player', '⭐', 50, 'silver', 'Play 50 competitive rounds'],
  ['games_100', 'Color Veteran', '🏅', 100, 'silver', 'Play 100 competitive rounds'],
  ['games_200', 'Committed', '🔗', 200, 'silver', 'Play 200 competitive rounds'],
  ['games_350', 'Devoted', '🕯️', 350, 'gold', 'Play 350 competitive rounds'],
  ['games_500', 'Half a Thousand', '🎖️', 500, 'gold', 'Play 500 competitive rounds'],
  ['games_750', 'Relentless', '⚙️', 750, 'gold', 'Play 750 competitive rounds'],
  ['games_1000', 'Four Digits', '🧿', 1000, 'platinum', 'Play 1,000 competitive rounds'],
  ['games_2000', 'Chromatic Obsession', '♾️', 2000, 'platinum', 'Play 2,000 competitive rounds'],
]);

// ── Streaks: current run, Hard and Extreme only (8) ────────────────────────
family('streak', 'current_streak', [
  ['streak_2', 'Back to Back', '🔗', 2, 'bronze', 'Hold a 2-round streak on Hard or Extreme'],
  ['streak_3', 'On Fire', '🔥', 3, 'bronze', 'Hold a 3-round streak on Hard or Extreme'],
  ['streak_5', 'Unstoppable', '⚡', 5, 'silver', 'Hold a 5-round streak on Hard or Extreme'],
  ['streak_7', 'Rolling', '🎲', 7, 'silver', 'Hold a 7-round streak on Hard or Extreme'],
  ['streak_10', 'Godlike', '👑', 10, 'gold', 'Hold a 10-round streak on Hard or Extreme'],
  ['streak_15', 'Untouchable', '🛡️', 15, 'gold', 'Hold a 15-round streak on Hard or Extreme'],
  ['streak_20', 'Locked In', '🔒', 20, 'platinum', 'Hold a 20-round streak on Hard or Extreme'],
  ['streak_30', 'Flow State', '🌊', 30, 'platinum', 'Hold a 30-round streak on Hard or Extreme'],
]);

// ── Streaks: best ever (5) ─────────────────────────────────────────────────
family('streak', 'best_streak', [
  ['best_streak_10', 'Personal Best', '📈', 10, 'silver', 'Reach a best streak of 10'],
  ['best_streak_20', 'High Water Mark', '🌊', 20, 'silver', 'Reach a best streak of 20'],
  ['best_streak_30', 'Record Holder', '📜', 30, 'gold', 'Reach a best streak of 30'],
  ['best_streak_50', 'Legendary Run', '🐉', 50, 'platinum', 'Reach a best streak of 50'],
  ['best_streak_75', 'Mythical', '🦄', 75, 'platinum', 'Reach a best streak of 75'],
]);

// ── Rating (9) ─────────────────────────────────────────────────────────────
// Thresholds are the floors of the bands in api/src/utils/rank.utils.ts. If the
// ladder moves these must move with it, or "Gold Rank" unlocks while the player
// is still shown as Silver.
family('elo', 'rating', [
  ['rating_500', 'Off the Ground', '🎈', 500, 'bronze', 'Reach 500 HuePoints'],
  ['rating_silver', 'Silver Rank', '🥈', 1000, 'bronze', 'Reach Silver rank (1,000 HuePoints)'],
  ['rating_1750', 'Climbing', '🧗', 1750, 'silver', 'Reach 1,750 HuePoints'],
  ['rating_gold', 'Gold Rank', '🥇', 2500, 'silver', 'Reach Gold rank (2,500 HuePoints)'],
  ['rating_4000', 'Ascendant', '🚀', 4000, 'gold', 'Reach 4,000 HuePoints'],
  ['rating_platinum', 'Platinum Rank', '💠', 6000, 'gold', 'Reach Platinum rank (6,000 HuePoints)'],
  ['rating_9000', 'Stratosphere', '🛰️', 9000, 'platinum', 'Reach 9,000 HuePoints'],
  ['rating_diamond', 'Diamond Rank', '💎', 13000, 'platinum', 'Reach Diamond rank (13,000 HuePoints)'],
]);

family('elo', 'rating_single_gain', [
  ['big_gain', 'Massive Haul', '💰', 60, 'gold', 'Gain 60 or more HuePoints from a single round'],
]);

// ── Difficulty: rounds played per difficulty (14) ──────────────────────────
family('modes', 'difficulty_games', [
  ['easy_10', 'Easy Does It', '🍀', 10, 'bronze', 'Complete 10 Easy rounds'],
  ['easy_50', 'Easy Regular', '🌿', 50, 'bronze', 'Complete 50 Easy rounds'],
  ['easy_100', 'Easy Century', '🌳', 100, 'silver', 'Complete 100 Easy rounds'],
], { difficulty: 'easy' });

family('modes', 'difficulty_games', [
  ['medium_10', 'Stepping Up', '🪜', 10, 'bronze', 'Complete 10 Medium rounds'],
  ['medium_50', 'Middle Ground', '⚖️', 50, 'silver', 'Complete 50 Medium rounds'],
  ['medium_100', 'Medium Century', '🏛️', 100, 'silver', 'Complete 100 Medium rounds'],
], { difficulty: 'medium' });

family('modes', 'difficulty_games', [
  ['first_hard', 'Brave Soul', '😤', 1, 'bronze', 'Complete your first Hard round'],
  ['hard_10', 'Hard Mode Enthusiast', '💪', 10, 'silver', 'Complete 10 Hard rounds'],
  ['hard_50', 'Hard Labour', '🔨', 50, 'gold', 'Complete 50 Hard rounds'],
  ['hard_100', 'Hard Century', '🗿', 100, 'platinum', 'Complete 100 Hard rounds'],
], { difficulty: 'hard' });

family('modes', 'difficulty_games', [
  ['first_extreme', 'Fearless', '😈', 1, 'bronze', 'Complete your first Extreme round'],
  ['extreme_10', 'Glutton for Punishment', '🌶️', 10, 'silver', 'Complete 10 Extreme rounds'],
  ['extreme_50', 'Pain Tolerance', '🔥', 50, 'gold', 'Complete 50 Extreme rounds'],
  ['extreme_100', 'Extreme Century', '☠️', 100, 'platinum', 'Complete 100 Extreme rounds'],
], { difficulty: 'extreme' });

// ── Difficulty: accuracy per difficulty (8) ────────────────────────────────
family('modes', 'difficulty_accuracy', [
  ['easy_acc_90', 'Easy Marksman', '🎯', 90, 'bronze', 'Hit 90% accuracy on Easy'],
  ['easy_acc_99', 'Flawless Easy', '🌟', 99, 'silver', 'Hit 99% accuracy on Easy'],
], { difficulty: 'easy' });

family('modes', 'difficulty_accuracy', [
  ['medium_acc_85', 'Medium Marksman', '🎯', 85, 'silver', 'Hit 85% accuracy on Medium'],
  ['medium_acc_95', 'Flawless Medium', '🌟', 95, 'gold', 'Hit 95% accuracy on Medium'],
], { difficulty: 'medium' });

family('modes', 'difficulty_accuracy', [
  ['hard_acc_80', 'Hard Marksman', '🎯', 80, 'silver', 'Hit 80% accuracy on Hard'],
  ['hard_acc_95', 'Flawless Hard', '🌟', 95, 'platinum', 'Hit 95% accuracy on Hard'],
], { difficulty: 'hard' });

family('modes', 'difficulty_accuracy', [
  ['extreme_acc_75', 'Extreme Marksman', '🎯', 75, 'gold', 'Hit 75% accuracy on Extreme'],
  ['extreme_acc_90', 'Flawless Extreme', '🌟', 90, 'platinum', 'Hit 90% accuracy on Extreme'],
], { difficulty: 'extreme' });

// ── Speed: accuracy on a short memorization window (4) ─────────────────────
// requirement_value is the accuracy; the window is in metadata.
family('speed', 'fast_memorize', [
  ['blink_70', 'Quick Study', '⏱️', 70, 'silver', 'Hit 70% with 3 seconds of memorization or less'],
  ['blink_85', 'Photographic', '📸', 85, 'gold', 'Hit 85% with 3 seconds of memorization or less'],
], { seconds: 3 });

family('speed', 'fast_memorize', [
  ['blink2_70', 'Snap Judgement', '⚡', 70, 'gold', 'Hit 70% with 2 seconds of memorization or less'],
], { seconds: 2 });

family('speed', 'fast_memorize', [
  ['blink1_80', 'Blink of an Eye', '👁️‍🗨️', 80, 'platinum', 'Hit 80% with 1 second of memorization or less'],
], { seconds: 1 });

// ── Daily challenge (14) ───────────────────────────────────────────────────
family('daily', 'daily_played', [
  ['daily_1', 'Daily Debut', '📆', 1, 'bronze', 'Play your first Daily Challenge'],
  ['daily_5', 'Habit Forming', '🔁', 5, 'bronze', 'Play 5 Daily Challenges'],
  ['daily_10', 'Daily Regular', '☕', 10, 'bronze', 'Play 10 Daily Challenges'],
  ['daily_25', 'Daily Devotee', '🗓️', 25, 'silver', 'Play 25 Daily Challenges'],
  ['daily_50', 'Half-Century Daily', '📔', 50, 'gold', 'Play 50 Daily Challenges'],
  ['daily_100', 'Daily Centurion', '📚', 100, 'platinum', 'Play 100 Daily Challenges'],
]);

family('daily', 'daily_streak', [
  ['daily_streak_3', 'Three in a Row', '3️⃣', 3, 'bronze', 'Play the Daily Challenge 3 days running'],
  ['daily_streak_7', 'Perfect Week', '7️⃣', 7, 'silver', 'Play the Daily Challenge 7 days running'],
  ['daily_streak_14', 'Fortnight', '🌗', 14, 'silver', 'Play the Daily Challenge 14 days running'],
  ['daily_streak_30', 'Full Month', '🌕', 30, 'gold', 'Play the Daily Challenge 30 days running'],
  ['daily_streak_60', 'Unbroken', '⛓️', 60, 'platinum', 'Play the Daily Challenge 60 days running'],
]);

family('daily', 'daily_accuracy', [
  ['daily_acc_90', 'Daily Sharpshooter', '🎯', 90, 'silver', 'Hit 90% accuracy on a Daily Challenge'],
  ['daily_acc_99', 'Daily Perfection', '🏆', 99, 'platinum', 'Hit 99% accuracy on a Daily Challenge'],
]);

// Inverted requirement: the value is a ceiling in milliseconds, not a floor.
family('daily', 'daily_speed', [
  ['daily_fast', 'No Hesitation', '💨', 5000, 'gold', 'Finish a Daily Challenge in under 5 seconds'],
]);

// ── Social (4) ─────────────────────────────────────────────────────────────
family('social', 'friends_count', [
  ['friends_1', 'Not Alone', '🤝', 1, 'bronze', 'Add your first friend'],
  ['friends_5', 'Circle', '👥', 5, 'bronze', 'Have 5 friends'],
  ['friends_10', 'Popular', '🎉', 10, 'silver', 'Have 10 friends'],
  ['friends_25', 'Ringleader', '🎪', 25, 'gold', 'Have 25 friends'],
]);

// ── Loyalty (3) ────────────────────────────────────────────────────────────
family('social', 'account_age_days', [
  ['age_7', 'One Week In', '🌱', 7, 'bronze', 'Have an account for 7 days'],
  ['age_30', 'One Month In', '🪴', 30, 'bronze', 'Have an account for 30 days'],
  ['age_365', 'One Year In', '🌲', 365, 'gold', 'Have an account for a year'],
]);

// ── Meta (1) ───────────────────────────────────────────────────────────────
family('meta', 'achievements_unlocked', [
  ['collector_50', 'Collector', '🗃️', 50, 'platinum', 'Unlock 50 other achievements'],
]);

/** Achievements that used to exist and must not linger as unreachable cards. */
const RETIRED_KEYS = ['first_win', 'mp_10_games'];

async function seedAchievements() {
  try {
    console.log('🌱 Seeding achievements...');

    const keys = rows.map(r => r.key);
    const duplicate = keys.find((k, i) => keys.indexOf(k) !== i);
    if (duplicate) throw new Error(`Duplicate achievement key: ${duplicate}`);

    for (const ach of rows) {
      await pool.query(
        `INSERT INTO achievements
           (key, name, description, category, icon,
            requirement_type, requirement_value, requirement_metadata,
            tier, points, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (key) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           category = EXCLUDED.category,
           icon = EXCLUDED.icon,
           requirement_type = EXCLUDED.requirement_type,
           requirement_value = EXCLUDED.requirement_value,
           requirement_metadata = EXCLUDED.requirement_metadata,
           tier = EXCLUDED.tier,
           points = EXCLUDED.points,
           sort_order = EXCLUDED.sort_order`,
        [
          ach.key,
          ach.name,
          ach.description,
          ach.category,
          ach.icon,
          ach.requirement_type,
          ach.requirement_value,
          JSON.stringify(ach.requirement_metadata),
          ach.tier,
          ach.points,
          ach.sort_order,
        ]
      );
    }

    // Drop retired achievements and anything else no longer in the catalogue.
    // A row left behind keeps its requirement_type, which the evaluator no
    // longer recognises — so it would render forever as a locked card stuck at
    // 0% that nobody can earn.
    const stale = await pool.query(
      `SELECT key FROM achievements WHERE key <> ALL($1::text[]) OR key = ANY($2::text[])`,
      [keys, RETIRED_KEYS]
    );
    const staleKeys = stale.rows.map((r: any) => r.key);

    if (staleKeys.length > 0) {
      // Unlocks first — user_achievements references the key.
      await pool.query(`DELETE FROM user_achievements WHERE achievement_key = ANY($1::text[])`, [
        staleKeys,
      ]);
      await pool.query(`DELETE FROM achievements WHERE key = ANY($1::text[])`, [staleKeys]);
      console.log(`🧹 Removed ${staleKeys.length} retired achievement(s): ${staleKeys.join(', ')}`);
    }

    // A pinned showcase can point at a key that just went away.
    await pool.query(
      `UPDATE users
       SET showcase_achievements = COALESCE((
         SELECT jsonb_agg(k) FROM jsonb_array_elements_text(showcase_achievements) AS k
         WHERE k IN (SELECT key FROM achievements)
       ), '[]'::jsonb)
       WHERE showcase_achievements IS NOT NULL
         AND showcase_achievements <> '[]'::jsonb`
    );

    const byTier = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.tier] = (acc[r.tier] ?? 0) + 1;
      return acc;
    }, {});

    console.log(`✅ Seeded ${rows.length} achievements`);
    console.log(
      `   ${Object.entries(byTier)
        .map(([tier, count]) => `${tier}: ${count}`)
        .join('  ·  ')}`
    );
    console.log(`   ${rows.reduce((sum, r) => sum + r.points, 0)} points available`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed achievements:', error);
    process.exit(1);
  }
}

seedAchievements();
