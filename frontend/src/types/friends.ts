/** Friend-system wire types. Mirrors api/src/services/friend.service.ts. */

/** How you relate to another account — decides which action button shows. */
export type FriendRelationship =
  | 'self'
  | 'none'
  | 'friends'
  | 'request_sent'
  | 'request_received'

export interface Friend {
  userId: string
  username: string
  rating: number | null
  rankTier: string | null
  friendsSince: string | null
  /** Connected to the socket server right now. Invites only work for these. */
  isOnline: boolean
  /**
   * What they're busy with. `in_game` means an invite would land over their
   * sliders, so the server rejects it too — this is only the label for it.
   */
  activity?: 'in_room' | 'in_game' | null
}

export interface FriendRequest {
  userId: string
  username: string
  rating: number | null
  rankTier: string | null
  requestedAt: string
}

export interface FriendSearchResult {
  userId: string
  username: string
  rating: number | null
  rankTier: string | null
  relationship: FriendRelationship
  isOnline: boolean
}

export interface FriendOverviewResponse {
  success: boolean
  friends: Friend[]
  /** Requests waiting on you. */
  incoming: FriendRequest[]
  /** Requests you sent that are still unanswered. */
  outgoing: FriendRequest[]
}

/** A room invite pushed to you by a friend. Not persisted — online delivery only. */
export interface RoomInvite {
  code: string
  fromUserId: string
  fromUsername: string
  difficulty: string
  playerCount: number
  maxPlayers: number
  /** The room is mid-game, so joining has to wait for it to finish. */
  inProgress: boolean
  sentAt: number
}

/**
 * An invite still waiting on an answer.
 *
 * Keyed by room rather than by sender, because a room is one place to go: two
 * friends inviting you to the same code is a single decision, so it stays a
 * single entry that names both of them.
 */
export interface PendingInvite extends RoomInvite {
  /** Everyone who invited you to this code, most recent first. */
  fromUsernames: string[]
  /**
   * When this client received it.
   *
   * Deliberately not `sentAt`, which is the server's clock — an expiry computed
   * against a clock that is minutes off would clear invites on arrival.
   */
  receivedAt: number
}
