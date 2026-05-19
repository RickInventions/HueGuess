import { useState, useEffect, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Calendar,
  Crown,
  Target,
  Zap,
  Swords,
  Edit2,
  Lock,
  Eye,
  ArrowLeft,
  Medal,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { user as userApi } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import { getRankProgress, RANK_ICONS, RANK_COLORS } from '../lib/constants'
import { format } from 'date-fns'
import { toast } from 'sonner'

export default function Profile() {
  const { username } = useParams<{ username: string }>()
  const { user, logout, resendVerification, checkAuth } = useAuth()
  const navigate = useNavigate()
  
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [resendingVerification, setResendingVerification] = useState(false)
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const isOwnProfile = !username || username === user?.username
  const targetUsername = isOwnProfile ? user?.username : username

  const loadProfile = useCallback(async () => {
    if (!targetUsername) return
    
    setLoading(true)
    try {
      if (isOwnProfile && user) {
        const response = await userApi.getOwnProfile()
        setProfile(response.data.profile)
      } else if (targetUsername) {
        const response = await userApi.getPublicProfile(targetUsername)
        setProfile(response.data.profile)
      }
    } catch (error) {
      console.error('Failed to load profile:', error)
      toast.error('Failed to load profile')
      if (!isOwnProfile) navigate('/')
    } finally {
      setLoading(false)
    }
  }, [targetUsername, isOwnProfile, user, navigate])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleResendVerification = async () => {
    if (!user?.email) return
    
    setResendingVerification(true)
    try {
      await resendVerification(user.email)
      toast.success('Verification email sent! Check your inbox.')
    } catch (error) {
      toast.error('Failed to resend verification email')
    } finally {
      setResendingVerification(false)
    }
  }

  const handleUsernameChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newUsername.length < 3) {
      setUsernameError('Username must be at least 3 characters')
      return
    }
    if (newUsername.length > 30) {
      setUsernameError('Username must be less than 30 characters')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setUsernameError('Username can only contain letters, numbers, and underscores')
      return
    }
    
    setSubmitting(true)
    setUsernameError('')
    
    try {
      await userApi.changeUsername(newUsername)
      toast.success('Username changed successfully!')
      setShowUsernameModal(false)
      setNewUsername('')
      await checkAuth()
      loadProfile()
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to change username'
      setUsernameError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    
    setSubmitting(true)
    setPasswordError('')
    
    try {
      await userApi.changePassword(currentPassword, newPassword)
      toast.success('Password changed successfully!')
      setShowPasswordModal(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to change password'
      setPasswordError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 flex justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-muted">User not found</p>
        <Link to="/" className="mt-4 inline-block">
          <Button>Go home</Button>
        </Link>
      </div>
    )
  }

  const stats = profile.stats
  const achievements = profile.achievements
  const tierColor = stats?.rankTier ? RANK_COLORS[stats.rankTier.toLowerCase() as keyof typeof RANK_COLORS] : '#667eea'
  const rankProgress = stats?.rating ? getRankProgress(stats.rating) : null
  const rankIcon = stats?.rankTier ? RANK_ICONS[stats.rankTier.toLowerCase() as keyof typeof RANK_ICONS] : '🎨'

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Username Change Modal */}
      {showUsernameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-heading text-xl font-semibold mb-4">Change Username</h3>
            <form onSubmit={handleUsernameChange}>
              <input
                type="text"
                placeholder="New username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-button bg-surface-alt border border-border text-deep mb-3 focus:outline-none focus:shadow-glow-primary"
                autoFocus
              />
              {usernameError && (
                <p className="text-accent text-sm mb-3">{usernameError}</p>
              )}
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowUsernameModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={submitting}>
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-heading text-xl font-semibold mb-4">Change Password</h3>
            <form onSubmit={handlePasswordChange}>
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-button bg-surface-alt border border-border text-deep mb-3 focus:outline-none focus:shadow-glow-primary"
                required
              />
              <input
                type="password"
                placeholder="New password (6+ characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-button bg-surface-alt border border-border text-deep mb-3 focus:outline-none focus:shadow-glow-primary"
                required
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-button bg-surface-alt border border-border text-deep mb-3 focus:outline-none focus:shadow-glow-primary"
                required
              />
              {passwordError && (
                <p className="text-accent text-sm mb-3">{passwordError}</p>
              )}
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={submitting}>
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Indicator (for other user's profiles) */}
      {!isOwnProfile && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted hover:text-deep transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Eye className="w-3 h-3" />
            Viewing {profile.user.username}'s profile
          </div>
          <div className="w-16" /> {/* Spacer for alignment */}
        </div>
      )}

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div
          className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl bg-gradient-to-br from-primary/20 to-accent/20"
        >
          {rankIcon}
        </div>

        <div className="flex items-center justify-center gap-2 flex-wrap">
          <h1 className="font-heading text-2xl font-semibold text-deep">{profile.user.username}</h1>
          {isOwnProfile && (
            <button
              onClick={() => setShowUsernameModal(true)}
              className="text-muted hover:text-deep transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-1 text-xs text-muted">
          <Calendar className="w-3 h-3" />
          Joined {format(new Date(profile.user.joinedDate), 'MMM d, yyyy')}
        </div>

        {/* Settings buttons for own profile */}
        {isOwnProfile && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="text-xs text-muted hover:text-deep transition-colors flex items-center gap-1"
            >
              <Lock className="w-3 h-3" />
              Change password
            </button>
          </div>
        )}
      </motion.div>

      {/* Competitive Stats */}
      {stats && stats.gamesPlayed > 0 ? (
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
                <span className="font-heading text-xl font-semibold" style={{ color: tierColor }}>
                  {stats.rankTier}
                </span>
              </div>

              <div>
                <span className="font-heading text-5xl font-bold" style={{ color: tierColor }}>
                  {stats.rating}
                </span>
                <span className="text-muted text-sm ml-2">HuePoints</span>
              </div>

              {/* Tier progress */}
              {rankProgress && rankProgress.nextTier !== 'Max' && (
                <div className="space-y-1">
                  <ProgressBar value={rankProgress.progress} color={tierColor} height={6} />
                  <p className="text-xs text-muted">
                    {rankProgress.needed} more to {rankProgress.nextTier}
                  </p>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Stats Grid - Only showing requested fields */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 gap-3"
          >
            <Card className="text-center">
              <Target className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-xl font-heading font-semibold">{Math.round(stats.avgAccuracy)}%</p>
              <p className="text-xs text-muted">Avg Accuracy</p>
            </Card>
            <Card className="text-center">
              <Zap className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
              <p className="text-xl font-heading font-semibold">{stats.bestStreak || 0}</p>
              <p className="text-xs text-muted">Best Streak</p>
            </Card>
            <Card className="text-center">
              <Swords className="w-5 h-5 text-accent mx-auto mb-2" />
              <p className="text-xl font-heading font-semibold">{stats.gamesPlayed}</p>
              <p className="text-xs text-muted">Games Played</p>
            </Card>
            <Card className="text-center">
              <div className="text-2xl mb-1">🏆</div>
              <p className="text-xl font-heading font-semibold">{stats.rankTier}</p>
              <p className="text-xs text-muted">Rank</p>
            </Card>
          </motion.div>

          {/* Achievements Section */}
          {achievements && achievements.unlocked && achievements.unlocked.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wider flex items-center gap-2">
                  <Medal className="w-4 h-4" />
                  Achievements ({achievements.totalUnlocked})
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {achievements.unlocked.slice(0, 6).map((ach: any) => (
                  <div
                    key={ach.key}
                    className="flex flex-col items-center text-center p-2 rounded-xl bg-surface-alt group hover:bg-surface-alt/70 transition-colors cursor-help"
                    title={`${ach.name}: ${ach.description}`}
                  >
                    <div className="text-2xl mb-1">{ach.icon}</div>
                    <p className="text-[10px] font-medium truncate max-w-full">{ach.name}</p>
                  </div>
                ))}
                {achievements.unlocked.length > 6 && (
                  <div className="flex flex-col items-center justify-center text-center p-2 rounded-xl bg-surface-alt">
                    <div className="text-sm font-semibold text-muted">+{achievements.unlocked.length - 6}</div>
                    <p className="text-[10px] text-muted">more</p>
                  </div>
                )}
              </div>
              {isOwnProfile && achievements.totalUnlocked < achievements.totalPossible && (
                <p className="text-xs text-muted text-center mt-2">
                  Keep playing to unlock more achievements!
                </p>
              )}
            </motion.div>
          )}

          {/* Games by difficulty - Only show if available */}
          {profile.gamesByDifficulty && profile.gamesByDifficulty.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card>
                <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wider mb-3">
                  Games by Difficulty
                </h3>
                <div className="space-y-2">
                  {profile.gamesByDifficulty.map((item: any) => (
                    <div key={item.difficulty} className="flex justify-between items-center">
                      <span className="text-sm capitalize">{item.difficulty}</span>
                      <span className="text-sm font-semibold">{item.count}</span>
                    </div>
                  ))}
                </div>
              </Card>
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
            {isOwnProfile && (
              <Link to="/play?mode=competitive">
                <Button variant="primary">Play Competitive</Button>
              </Link>
            )}
          </Card>
        </motion.div>
      )}

      {/* Logout (own profile only) */}
      {isOwnProfile && (
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
      )}
    </div>
  )
}