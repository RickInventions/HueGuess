/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Target, ArrowLeft, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getUserStats, type CompetitiveStats, type RankTier } from '@/lib/competitive';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { CompetitiveGameScreen } from '@/components/game/CompetitiveGameScreen';

const rankTierColors: Record<RankTier, string> = {
  bronze: 'from-amber-700 to-amber-600',
  silver: 'from-gray-400 to-gray-300',
  gold: 'from-yellow-500 to-yellow-400',
  platinum: 'from-cyan-500 to-cyan-400',
  diamond: 'from-purple-500 to-pink-400',
};

export function CompetitivePage() {
  const { isAuthenticated, isLoading, logout, user } = useAuthStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [stats, setStats] = useState<CompetitiveStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await getUserStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };
  
  useEffect(() => {
    if (isAuthenticated) {
      loadStats();
    }
  }, [isAuthenticated]);
  
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Trophy className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-30" />
          <h2 className="text-section text-text-deep mb-4">Compete & Climb</h2>
          <p className="text-text-muted mb-8 max-w-md">
            Sign in to play competitively, earn ratings, and climb the leaderboard.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/login">
              <Button size="lg">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button variant="secondary" size="lg">Create Account</Button>
            </Link>
          </div>
          <Link to="/" className="block mt-6 text-text-muted hover:text-text-deep transition-colors">
            <ArrowLeft className="w-4 h-4 inline mr-1" />
            Back to Home
          </Link>
        </motion.div>
      </div>
    );
  }
  
  // Game screen
  if (isPlaying) {
    return <CompetitiveGameScreen onExit={() => { setIsPlaying(false); loadStats(); }} />;
  }
  
  // Dashboard
  return (
    <div className="min-h-screen flex flex-col px-6 py-8">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-text-muted hover:text-text-deep transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-section text-text-deep">Competitive</h1>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-text-muted hover:text-accent transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
        
        {/* User greeting */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-text-muted">Welcome back,</p>
          <h2 className="text-2xl font-heading font-semibold text-text-deep">{user?.username}</h2>
        </motion.div>
        
        {/* Stats Cards */}
        {statsLoading ? (
          <div className="grid grid-cols-2 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface-white rounded-card card-shadow p-6 animate-pulse">
                <div className="h-4 bg-surface-muted rounded w-20 mb-2" />
                <div className="h-8 bg-surface-muted rounded w-16" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <motion.div
            className="grid grid-cols-2 gap-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Rating */}
            <Card>
              <p className="text-sm text-text-muted mb-1">Rating</p>
              <p className="text-2xl font-heading font-bold text-text-deep">
                {Math.round(stats.rating)}
              </p>
              <div className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r text-white mt-2',
                rankTierColors[stats.rankTier]
              )}>
                <Trophy className="w-3 h-3" />
                {stats.rankTier}
              </div>
            </Card>
            
            {/* Rank */}
            <Card>
              <p className="text-sm text-text-muted mb-1">Global Rank</p>
              <p className="text-2xl font-heading font-bold text-text-deep">
                #{stats.rank > 0 ? stats.rank : '-'}
              </p>
              <TrendingUp className="w-4 h-4 text-text-muted mt-2" />
            </Card>
            
            {/* Avg Accuracy */}
            <Card>
              <p className="text-sm text-text-muted mb-1">Avg Accuracy</p>
              <p className="text-2xl font-heading font-bold text-text-deep">
                {stats.avgAccuracy.toFixed(1)}%
              </p>
            </Card>
            
            {/* Best Score */}
            <Card>
              <p className="text-sm text-text-muted mb-1">Best Score</p>
              <p className="text-2xl font-heading font-bold text-success">
                {stats.bestScore.toFixed(1)}%
              </p>
              <Target className="w-4 h-4 text-success mt-2" />
            </Card>
            
            {/* Games Played */}
            <Card className="col-span-2">
              <p className="text-sm text-text-muted mb-1">Games Played</p>
              <p className="text-2xl font-heading font-bold text-text-deep">
                {stats.gamesPlayed}
              </p>
            </Card>
          </motion.div>
        ) : (
          <Card className="text-center py-8 mb-8">
            <p className="text-text-muted mb-4">No stats yet. Play your first competitive game!</p>
          </Card>
        )}
        
        {/* Play Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Button size="lg" className="w-full" onClick={() => setIsPlaying(true)}>
            Play Competitive
          </Button>
        </motion.div>
        
        {/* Leaderboard link */}
        <div className="text-center mt-6">
          <Link
            to="/leaderboard"
            className="text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            <Trophy className="w-4 h-4" />
            View Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}