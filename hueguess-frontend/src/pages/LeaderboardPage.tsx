/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Crown } from 'lucide-react';
import { getLeaderboard, type LeaderboardEntry, type LeaderboardPeriod } from '@/lib/competitive';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

const tiers: { name: LeaderboardPeriod; label: string }[] = [
  { name: 'daily', label: 'Today' },
  { name: 'weekly', label: 'This Week' },
  { name: 'all-time', label: 'All Time' },
];

const rankTierColors: Record<string, string> = {
  bronze: 'from-amber-700 to-amber-600',
  silver: 'from-gray-400 to-gray-300',
  gold: 'from-yellow-500 to-yellow-400',
  platinum: 'from-cyan-500 to-cyan-400',
  diamond: 'from-purple-500 to-pink-400',
};

const rankTierIcons: Record<string, typeof Medal> = {
  bronze: Medal,
  silver: Medal,
  gold: Medal,
  platinum: Crown,
  diamond: Trophy,
};

export function LeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('all-time');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const data = await getLeaderboard(period);
      setEntries(data.entries);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    loadLeaderboard();
  }, [period]);
  
  
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="w-6 h-6 flex items-center justify-center text-text-muted font-mono text-sm">{rank}</span>;
  };
  
  return (
    <div className="min-h-screen flex flex-col px-6 py-12">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-section text-text-deep mb-2">Leaderboard</h1>
          <p className="text-text-muted">See who has the best color memory</p>
        </motion.div>
        
        {/* Period Tabs */}
        <div className="flex gap-2 mb-8 bg-surface-muted rounded-pill p-1">
          {tiers.map((tier) => (
            <button
              key={tier.name}
              onClick={() => setPeriod(tier.name)}
              className={cn(
                'flex-1 py-2 px-4 rounded-pill font-medium text-sm transition-all',
                period === tier.name
                  ? 'bg-surface-white text-text-deep shadow-sm'
                  : 'text-text-muted hover:text-text-deep'
              )}
            >
              {tier.label}
            </button>
          ))}
        </div>
        
        {/* Leaderboard List */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-surface-white rounded-card card-shadow p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-surface-muted rounded-full" />
                  <div className="flex-1 h-4 bg-surface-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <Card className="text-center py-12">
            <Trophy className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-30" />
            <p className="text-text-muted">No players yet. Be the first!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, index) => {
              const Icon = rankTierIcons[entry.rankTier] || Medal;
              
              return (
                <motion.div
                  key={entry.userId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={cn(
                    'flex items-center gap-4 relative overflow-hidden',
                    index === 0 && 'ring-2 ring-yellow-400/30'
                  )}>
                    {/* Rank */}
                    <div className="flex-shrink-0 w-10 text-center">
                      {getRankIcon(entry.rank)}
                    </div>
                    
                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-text-deep truncate">
                          {entry.username}
                        </p>
                        <div className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r text-white',
                          rankTierColors[entry.rankTier]
                        )}>
                          <Icon className="w-3 h-3" />
                          {entry.rankTier}
                        </div>
                      </div>
                      <p className="text-sm text-text-muted">
                        {entry.gamesPlayed} games · {entry.avgAccuracy.toFixed(1)}% avg
                      </p>
                    </div>
                    
                    {/* Rating */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-lg font-heading font-bold text-text-deep">
                        {Math.round(entry.rating)}
                      </p>
                      <p className="text-xs text-text-muted">rating</p>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}