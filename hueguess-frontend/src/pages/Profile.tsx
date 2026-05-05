import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Crown,
  Target,
  Zap,
  TrendingUp,
  Swords,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import { TIER_COLORS, RANK_TIERS, type RankTier } from '../lib/constants'
import type { PlayerStats, RatingHistoryEntry } from '../types'
import { format } from 'date-fns'

export default function Profile() {
  const { user, logout } = useAuth()
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [history, setHistory] = useState<RatingHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [resendingVerification, setResendingVerification] = useState(false)

  useEffect(() => {
    if (!user) return

    api.getStats()
      .then((data) => {
        setStats(data.stats)
        setHistory(data.ratingHistory?.slice(0, 20) || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  const handleResendVerification = useCallback(async () => {
    // The backend sends verification on register. For now, inform user to check email.
    // In a full implementation, you'd add a resend endpoint.
    setResendingVerification(true)
    setTimeout(() => setResendingVerification(false), 2000)
  }, [])

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-muted">Please log in to view your profile.</p>
        <Link to="/login" className="mt-4 inline-block">
          <Button>Log in</Button>
        </Link>
      </div>
    )
  }

  const tierColor = stats ? TIER_COLORS[stats.rankTier as RankTier] || '#CD7F32' : '#CD7F32'
  const tierIndex = stats ? RANK_TIERS.indexOf(stats.rankTier as RankTier) : 0
  const nextTier = tierIndex < RANK_TIERS.length - 1 ? RANK_TIERS[tierIndex + 1] : null

  // Calculate tier progress
  const tierThresholds: Record<string, number> = {
    Bronze: 0, Silver: 150, Gold: 300, Platinum: 500, Diamond: 750,
  }
  const currentTierMin = tierThresholds[stats?.rankTier || 'Bronze']
  const nextTierMin = nextTier ? tierThresholds[nextTier] : currentTierMin + 1
  const tierProgress = stats
    ? ((stats.rating - currentTierMin) / (nextTierMin - currentTierMin)) * 100
    : 0

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        {/* Avatar */}
        <div
          className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-heading font-bold text-white"
          style={{ backgroundColor: tierColor }}
        >
          {user.username.charAt(0).toUpperCase()}
        </div>

        <div>
          <h1 className="font-heading text-2xl font-semibold text-deep">{user.username}</h1>
          <p className="text-muted text-sm flex items-center justify-center gap-1 mt-1">
            <Mail className="w-3 h-3" />
            {user.email}
          </p>
        </div>

        {/* Verification status */}
        <div className="flex items-center justify-center gap-2">
          {user.is_verified ? (
            <>
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="text-sm text-success font-medium">Verified</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-accent" />
              <span className="text-sm text-accent font-medium">Not verified</span>
              <button
                onClick={handleResendVerification}
                disabled={resendingVerification}
                className="text-xs text-primary hover:underline ml-1"
              >
                {resendingVerification ? 'Check your email' : 'Resend'}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-1 text-xs text-muted">
          <Calendar className="w-3 h-3" />
          Joined {format(new Date(user.created_at), 'MMM d, yyyy')}
        </div>
      </motion.div>

      {/* Competitive Stats */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : stats ? (
        <>
          {/* Tier Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="text-center space-y-3">
              <div className="flex items-center justify-center gap-3">
                <Crown className="w-6 h-6" style={{ color: tierColor }} />
                <span
                  className="font-heading text-xl font-semibold"
                  style={{ color: tierColor }}
                >
                  {stats.rankTier}
                </span>
              </div>

              <div>
                <span className="font-heading text-5xl font-bold" style={{ color: tierColor }}>
                  {stats.rating}
                </span>
                <span className="text-muted text-sm ml-2">Huepoints</span>
              </div>

              {/* Tier progress */}
              {nextTier && (
                <div className="space-y-1">
                  <ProgressBar
                    value={tierProgress}
                    color={tierColor}
                    height={6}
                  />
                  <p className="text-xs text-muted">
                    {nextTierMin - stats.rating} more to{' '}
                    <span style={{ color: TIER_COLORS[nextTier as RankTier] }}>{nextTier}</span>
                  </p>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 gap-3"
          >
            <Card className="text-center">
              <Target className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-xl font-heading font-semibold">{stats.avgAccuracy}%</p>
              <p className="text-xs text-muted">Avg Accuracy</p>
            </Card>
            <Card className="text-center">
              <TrendingUp className="w-5 h-5 text-success mx-auto mb-2" />
              <p className="text-xl font-heading font-semibold">{stats.bestScore}</p>
              <p className="text-xs text-muted">Best Score</p>
            </Card>
            <Card className="text-center">
              <Zap className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
              <p className="text-xl font-heading font-semibold">{stats.currentStreak}</p>
              <p className="text-xs text-muted">Current Streak</p>
            </Card>
            <Card className="text-center">
              <Swords className="w-5 h-5 text-accent mx-auto mb-2" />
              <p className="text-xl font-heading font-semibold">{stats.gamesPlayed}</p>
              <p className="text-xs text-muted">Games Played</p>
            </Card>
          </motion.div>

          {/* Win rate */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted">Win Rate</span>
                <span className="text-sm font-heading font-semibold">
                  {stats.gamesPlayed > 0
                    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
                    : 0}
                  %
                </span>
              </div>
              <ProgressBar
                value={stats.gamesPlayed > 0 ? (stats.gamesWon / stats.gamesPlayed) * 100 : 0}
                color="#1FC98E"
                height={8}
              />
              <p className="text-xs text-muted mt-2">
                {stats.gamesWon} wins / {stats.gamesPlayed} games
              </p>
            </Card>
          </motion.div>

          {/* Rating History */}
          {history.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wider mb-3">
                Rating History
              </h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {history.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-alt text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted capitalize w-16">{entry.difficulty}</span>
                      <span className="text-xs">{entry.accuracy}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">
                        {entry.ratingBefore} → {entry.ratingAfter}
                      </span>
                      <span
                        className={`text-xs font-heading font-semibold ${
                          entry.ratingChange >= 0 ? 'text-success' : 'text-accent'
                        }`}
                      >
                        {entry.ratingChange >= 0 ? '+' : ''}{entry.ratingChange}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="text-center py-8 space-y-3">
            <Swords className="w-10 h-10 text-muted mx-auto" />
            <p className="text-muted">No competitive stats yet</p>
            <Link to="/play?mode=competitive">
              <Button variant="primary">Play Competitive</Button>
            </Link>
          </Card>
        </motion.div>
      )}

      {/* Logout */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center pt-4"
      >
        <Button variant="ghost" onClick={logout}>
          Log out
        </Button>
      </motion.div>
    </div>
  )
}