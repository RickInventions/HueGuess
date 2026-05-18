import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TrendingUp, Target, Zap, Trophy, Crown, ArrowRight } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import { TIER_COLORS, RANK_TIERS, type RankTier } from '../lib/constants'
import type { PlayerStats, RatingHistoryEntry } from '../types'

export default function Stats() {
  const { user } = useAuth()
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [history, setHistory] = useState<RatingHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getStats()
      .then((data) => {
        setStats(data.stats)
        setHistory(data.ratingHistory?.slice(0, 10) || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-3.5rem)]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-3.5rem)] px-4 text-center space-y-4">
        <Trophy className="w-12 h-12 text-muted" />
        <p className="text-muted">Play a competitive game to see your stats.</p>
        <Link to="/play?mode=competitive">
          <Button variant="primary">Play Competitive</Button>
        </Link>
      </div>
    )
  }

  const tierColor = TIER_COLORS[stats.rankTier as RankTier] || '#CD7F32'
  const tierIndex = RANK_TIERS.indexOf(stats.rankTier as RankTier)
  const nextTier = tierIndex < RANK_TIERS.length - 1 ? RANK_TIERS[tierIndex + 1] : null

  const tierThresholds: Record<string, number> = {
    Bronze: 0, Silver: 150, Gold: 300, Platinum: 500, Diamond: 750,
  }
  const currentTierMin = tierThresholds[stats.rankTier]
  const nextTierMin = nextTier ? tierThresholds[nextTier] : currentTierMin + 1
  const tierProgress = ((stats.rating - currentTierMin) / (nextTierMin - currentTierMin)) * 100

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Header with profile link */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-section">Your Stats</h2>
        {user && (
          <Link to="/profile">
            <Button variant="ghost">
              Profile
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        )}
      </div>

      {/* Tier Badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-heading font-semibold text-sm"
          style={{ backgroundColor: `${tierColor}15`, color: tierColor }}
        >
          <Crown className="w-4 h-4" />
          {stats.rankTier}
        </div>
        <div className="mt-4">
          <span className="font-heading text-score" style={{ color: tierColor }}>
            {stats.rating}
          </span>
          <span className="text-muted text-sm ml-2">Huepoints</span>
        </div>

        {/* Tier progress */}
        {nextTier && (
          <div className="mt-3 max-w-xs mx-auto space-y-1">
            <ProgressBar value={tierProgress} color={tierColor} height={6} />
            <p className="text-xs text-muted">
              {nextTierMin - stats.rating} points to{' '}
              <span style={{ color: TIER_COLORS[nextTier as RankTier] }}>{nextTier}</span>
            </p>
          </div>
        )}
      </motion.div>

      {/* Stats grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3"
      >
        <Card className="text-center">
          <Target className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="text-2xl font-heading font-semibold">{stats.avgAccuracy}%</p>
          <p className="text-xs text-muted">Avg Accuracy</p>
        </Card>
        <Card className="text-center">
          <Trophy className="w-5 h-5 text-accent mx-auto mb-2" />
          <p className="text-2xl font-heading font-semibold">{stats.bestScore}</p>
          <p className="text-xs text-muted">Best Score</p>
        </Card>
        <Card className="text-center">
          <Zap className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
          <p className="text-2xl font-heading font-semibold">{stats.currentStreak}</p>
          <p className="text-xs text-muted">Streak</p>
        </Card>
        <Card className="text-center">
          <TrendingUp className="w-5 h-5 text-success mx-auto mb-2" />
          <p className="text-2xl font-heading font-semibold">{stats.gamesPlayed}</p>
          <p className="text-xs text-muted">Games</p>
        </Card>
      </motion.div>

      {/* Quick links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-3"
      >
        <Link to="/play?mode=competitive" className="flex-1">
          <Button variant="primary" fullWidth>
            Play
          </Button>
        </Link>
        <Link to="/leaderboard" className="flex-1">
          <Button variant="secondary" fullWidth>
            Leaderboard
          </Button>
        </Link>
      </motion.div>

      {/* Rating History */}
      {history.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wider mb-3">
            Recent Rating Changes
          </h3>
          <div className="space-y-2">
            {history.map((entry, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2 rounded-xl bg-surface-alt"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted capitalize">{entry.difficulty}</span>
                  <span className="text-sm">{entry.accuracy}%</span>
                </div>
                <span
                  className={`font-heading font-semibold text-sm ${
                    entry.ratingChange >= 0 ? 'text-success' : 'text-accent'
                  }`}
                >
                  {entry.ratingChange >= 0 ? '+' : ''}{entry.ratingChange}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}