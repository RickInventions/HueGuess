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
