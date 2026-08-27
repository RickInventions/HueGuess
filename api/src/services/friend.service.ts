import pool from '../config/db.js';

/**
 * Friendships.
 *
 * One row per pair, ordered by who sent the request. `status` is 'pending' until
 * the addressee accepts; a decline deletes the row so the pair can try again
 * later rather than being locked out by a tombstone.
 */

export type FriendshipStatus = 'pending' | 'accepted';

export interface FriendSummary {
  userId: string;
  username: string;
  rating: number | null;
  rankTier: string | null;
  friendsSince: string | null;
}

export interface FriendRequestSummary {
  userId: string;
  username: string;
  rating: number | null;
  rankTier: string | null;
  requestedAt: string;
}

/** How the viewer relates to another account — drives the button in the UI. */
export type RelationshipState =
  | 'self'
  | 'none'
  | 'friends'
  | 'request_sent'
  | 'request_received';

const MAX_FRIENDS = 200;

export class FriendService {
  /** Accepted friends, with enough stats to render a row. */
  static async listFriends(userId: string): Promise<FriendSummary[]> {
    const result = await pool.query(
      `SELECT u.id, u.username, cs.rating, cs.rank_tier, f.responded_at
         FROM friendships f
         JOIN users u
           ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
         LEFT JOIN competitive_stats cs ON cs.user_id = u.id
        WHERE f.status = 'accepted'
          AND (f.requester_id = $1 OR f.addressee_id = $1)
        ORDER BY u.username`,
      [userId]
    );

    return result.rows.map(row => ({
      userId: String(row.id),
      username: row.username,
      rating: row.rating ?? null,
      rankTier: row.rank_tier ?? null,
      friendsSince: row.responded_at ?? null,
    }));
  }

  /** Requests waiting on this user to accept or decline. */
  static async listIncoming(userId: string): Promise<FriendRequestSummary[]> {
    const result = await pool.query(
      `SELECT u.id, u.username, cs.rating, cs.rank_tier, f.created_at
         FROM friendships f
         JOIN users u ON u.id = f.requester_id
         LEFT JOIN competitive_stats cs ON cs.user_id = u.id
        WHERE f.addressee_id = $1 AND f.status = 'pending'
        ORDER BY f.created_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      userId: String(row.id),
      username: row.username,
      rating: row.rating ?? null,
      rankTier: row.rank_tier ?? null,
      requestedAt: row.created_at,
    }));
  }

  /** Requests this user has sent that nobody has answered yet. */
  static async listOutgoing(userId: string): Promise<FriendRequestSummary[]> {
    const result = await pool.query(
      `SELECT u.id, u.username, cs.rating, cs.rank_tier, f.created_at
         FROM friendships f
         JOIN users u ON u.id = f.addressee_id
         LEFT JOIN competitive_stats cs ON cs.user_id = u.id
        WHERE f.requester_id = $1 AND f.status = 'pending'
        ORDER BY f.created_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      userId: String(row.id),
      username: row.username,
      rating: row.rating ?? null,
      rankTier: row.rank_tier ?? null,
      requestedAt: row.created_at,
    }));
  }

  /** Everything the friends modal needs, in one round trip. */
  static async getOverview(userId: string) {
    const [friends, incoming, outgoing] = await Promise.all([
      this.listFriends(userId),
      this.listIncoming(userId),
      this.listOutgoing(userId),
    ]);
    return { friends, incoming, outgoing };
  }

  /** True when the two users are accepted friends. */
  static async areFriends(a: string, b: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM friendships
        WHERE status = 'accepted'
          AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
        LIMIT 1`,
      [a, b]
    );
    return (result.rowCount ?? 0) > 0;
  }

  static async getRelationship(viewerId: string, otherId: string): Promise<RelationshipState> {
    if (viewerId === otherId) return 'self';

    const result = await pool.query(
      `SELECT requester_id, status FROM friendships
        WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)
        LIMIT 1`,
      [viewerId, otherId]
    );

    const row = result.rows[0];
    if (!row) return 'none';
    if (row.status === 'accepted') return 'friends';
    return String(row.requester_id) === viewerId ? 'request_sent' : 'request_received';
  }

  /**
   * Send a friend request.
   *
   * If the other person already has a request open with us, this accepts theirs
   * instead of creating a mirror row — otherwise two people clicking "add" at the
   * same time would deadlock into a pair of pending requests neither can accept.
   */
  static async sendRequest(
    requesterId: string,
    addresseeId: string
  ): Promise<{ status: 'pending' | 'accepted'; friend: { userId: string; username: string } }> {
    if (requesterId === addresseeId) throw new Error('You cannot add yourself');

    const target = await pool.query(`SELECT id, username FROM users WHERE id = $1`, [addresseeId]);
    if (target.rowCount === 0) throw new Error('User not found');

    const existing = await pool.query(
      `SELECT id, requester_id, status FROM friendships
        WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)
        LIMIT 1`,
      [requesterId, addresseeId]
    );

    const row = existing.rows[0];
    if (row) {
      if (row.status === 'accepted') throw new Error('You are already friends');
      if (String(row.requester_id) === requesterId) throw new Error('Request already sent');

      // They asked first — treat this as accepting.
      await pool.query(
        `UPDATE friendships SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
        [row.id]
      );
      return {
        status: 'accepted',
        friend: { userId: String(target.rows[0].id), username: target.rows[0].username },
      };
    }

    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM friendships
        WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)`,
      [requesterId]
    );
    if ((count.rows[0]?.n ?? 0) >= MAX_FRIENDS) {
      throw new Error(`You have reached the ${MAX_FRIENDS} friend limit`);
    }

    await pool.query(
      `INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')`,
      [requesterId, addresseeId]
    );

    return {
      status: 'pending',
      friend: { userId: String(target.rows[0].id), username: target.rows[0].username },
    };
  }

  /** Accept a request addressed to this user. */
  static async acceptRequest(userId: string, requesterId: string): Promise<void> {
    const result = await pool.query(
      `UPDATE friendships SET status = 'accepted', responded_at = NOW()
        WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [requesterId, userId]
    );
    if (result.rowCount === 0) throw new Error('No pending request from that user');
  }

  /**
   * Decline a request addressed to this user. The row is deleted rather than
   * marked, so the pair is free to try again later.
   */
  static async declineRequest(userId: string, requesterId: string): Promise<void> {
    const result = await pool.query(
      `DELETE FROM friendships
        WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [requesterId, userId]
    );
    if (result.rowCount === 0) throw new Error('No pending request from that user');
  }

  /** Withdraw a request this user sent. */
  static async cancelRequest(userId: string, addresseeId: string): Promise<void> {
    const result = await pool.query(
      `DELETE FROM friendships
        WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [userId, addresseeId]
    );
    if (result.rowCount === 0) throw new Error('No pending request to that user');
  }

  /** Remove a friend, in either direction. */
  static async removeFriend(userId: string, friendId: string): Promise<void> {
    const result = await pool.query(
      `DELETE FROM friendships
        WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [userId, friendId]
    );
    if (result.rowCount === 0) throw new Error('You are not friends with that user');
  }

  /**
   * Username search annotated with the viewer's relationship to each hit, so the
   * modal can render the right action without a follow-up request per row.
   */
  static async search(viewerId: string, term: string, limit = 10) {
    const result = await pool.query(
      `SELECT u.id, u.username, cs.rating, cs.rank_tier,
              f.status AS friendship_status, f.requester_id
         FROM users u
         LEFT JOIN competitive_stats cs ON cs.user_id = u.id
         LEFT JOIN friendships f
           ON (f.requester_id = $2 AND f.addressee_id = u.id)
           OR (f.addressee_id = $2 AND f.requester_id = u.id)
        WHERE u.username ILIKE $1 AND u.id <> $2
        ORDER BY u.username
        LIMIT $3`,
      [`%${term}%`, viewerId, limit]
    );

    return result.rows.map(row => {
      let relationship: RelationshipState = 'none';
      if (row.friendship_status === 'accepted') relationship = 'friends';
      else if (row.friendship_status === 'pending') {
        relationship = String(row.requester_id) === viewerId ? 'request_sent' : 'request_received';
      }

      return {
        userId: String(row.id),
        username: row.username,
        rating: row.rating ?? null,
        rankTier: row.rank_tier ?? null,
        relationship,
      };
    });
  }
}
