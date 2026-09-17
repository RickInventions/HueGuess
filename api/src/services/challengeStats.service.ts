import pool from '../config/db.js';

/**
 * The only challenge-mode data that reaches the database.
 *
 * Rooms live in memory on purpose — a room is a few seconds of ephemeral state,
 * and the socket layer touches no table at all. These two counters are the one
 * exception, because they are the whole of what an admin needs to see.
 *
 * Two rules keep them from costing a game anything:
 *
 *   1. Nothing is written per round. Rounds are counted in memory on the player,
 *      using the `roundsPlayed` that `endRound` already maintains — it is
 *      incremented for contenders only, so a spectator's round never reaches it —
 *      and banked once, when the player's time in the room is up.
 *   2. Nothing here is awaited. Every call is fire-and-forget from the socket
 *      layer, so a slow or failing write cannot hold up a room.
 */

/** The shape this needs from a player. Structural, so the socket layer keeps the real type. */
interface Participant {
  userId: string;
  roundsPlayed: number;
}

/**
 * Bank what a set of players did, and forget about it.
 *
 * `completedGame` is true only for a game that ran to its last round. An
 * elimination game that stopped with one player left standing is not a completed
 * game — it stopped early by design — and neither is a room that emptied out.
 *
 * Whether the player themselves survived does not enter into it. The counter
 * records *games*, which is what makes it a different number from the round
 * count beside it: a player knocked out in round 2 of a game that ran to round 8
 * banks eight rounds and one game.
 *
 * This adds whatever it is given, so calling it twice for one player doubles the
 * count. Callers guard against that, because a double count is silent and
 * permanent.
 */
export function recordChallengePlay(
  mode: string,
  players: Participant[],
  completedGame: boolean
): void {
  // Duel shares the room plumbing but is a different game; only challenge play
  // counts here.
  if (mode !== 'challenge') return;

  const games = completedGame ? 1 : 0;

  for (const player of players) {
    // A spectator who never played, or a lobby member when a game was abandoned
    // before round one, has nothing to bank.
    if (!player.userId || (games === 0 && player.roundsPlayed <= 0)) continue;

    // One statement per player, never awaited. `id = $1` takes its type from the
    // column, so this holds whatever users.id is, and it is a primary key lookup
    // — eight of them at the end of a game is nothing.
    pool
      .query(
        `UPDATE users
            SET total_challenge_games  = total_challenge_games  + $2,
                total_challenge_rounds = total_challenge_rounds + $3
          WHERE id = $1`,
        [player.userId, games, player.roundsPlayed]
      )
      .catch(error => {
        // Never rethrown: this runs off the back of a game ending, and by then
        // there is no caller left to tell. The stat is dropped, not the room.
        console.warn(
          `⚠️  Challenge stats not recorded for ${player.userId}:`,
          (error as Error).message
        );
      });
  }
}
