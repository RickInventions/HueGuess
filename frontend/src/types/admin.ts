export interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  totalCompetitiveGames: number;
  totalCasualGames: number;
  activeUsers24h: number;
  averageRating: number;
  pendingFeedback: number;
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