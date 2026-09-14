export interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  totalCompetitiveGames: number;
  totalCasualGames: number;
  activeUsers24h: number;
  averageRating: number;
  pendingFeedback: number;
  bannedUsers: number;
  suspendedUsers: number;
  signups7d: number;
  signups30d: number;
  totalRounds: number;
  /** Live socket count. In-memory, so it can disagree with `activeUsers24h`. */
  onlineNow: number;
  recentSignups: AdminUser[];
  topPlayers: TopPlayer[];
  recentActions: AdminLog[];
}

export interface TopPlayer {
  id: string;
  username: string;
  rating: number;
  rank_tier: string | null;
  games_played: number;
}

export interface AdminLog {
  id: number;
  admin_id: string | null;
  action: string;
  details: Record<string, any> | null;
  created_at: string;
}

/** How long a restriction lasts. `null` is permanent. */
export type RestrictionDuration = number | null;

export interface BanInfo {
  reason: string | null;
  /** ISO timestamp the suspension lapses at; null when the ban is permanent. */
  until: string | null;
  permanent: boolean;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  is_verified: boolean;
  rating: number;
  games_played: number;
  avg_accuracy: number;
  created_at: string;
  last_username_change: string | null;
  /** When set, the account was restricted at some point. */
  banned_at?: string | null;
  banned_until?: string | null;
  ban_reason?: string | null;
  banned_by?: string | null;
  /** Computed by the server: restricted *right now*, expiry included. */
  is_restricted?: boolean;
}

/**
 * What GET /admin/users/:userId adds over a list row. Optional because the
 * detail modal opens with the row data and fills these in once the fetch lands.
 */
export interface AdminUserDetail extends AdminUser {
  rank_tier?: string | null;
  current_streak?: number | null;
  best_streak?: number | null;
  total_games?: number | string | null;
  moderationHistory?: AdminLog[];
}

export interface FeedbackItem {
  id: string;
  type: 'bug' | 'feature' | 'review' | 'other';
  title: string;
  description: string;
  contact_email: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  user_id: string | null;
  username: string | null;
}

export interface FeedbackStats {
  total: number;
  pending: number;
  bugs: number;
  features: number;
  reviews: number;
  other: number;
}