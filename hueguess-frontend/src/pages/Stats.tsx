import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Target, Zap, Trophy, Crown } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui/Card'
import { TIER_COLORS, type RankTier } from '../lib/constants'
import type { PlayerStats, RatingHistoryEntry } from '../types'

export default function Stats() {
  useAuth()
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
      <div className="flex items-center justify-center min-h-[calc(100dvh-3.5rem)]">
        <p className="text-muted">Play a competitive game to see your stats.</p>
      </div>
    )
  }

  const tierColor = TIER_COLORS[stats.rankTier as RankTier] || '#CD7F32'

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
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

      {/* Rating History */}
      {history.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
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