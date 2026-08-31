import { useState, useEffect, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Calendar,
  Target,
  Zap,
  Swords,
  Edit2,
  Lock,
  ArrowLeft,
  Medal,
  UserPlus,
  UserCheck,
  UserMinus,
  Check,
  X,
  Clock,
  LogOut,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'
import { user as userApi } from '../lib/api'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { RankBadge } from '../components/ui/RankBadge'
import { getRankProgress, rankColor, rankIcon } from '../lib/constants'
import { format } from 'date-fns'
import { toast } from 'sonner'

/** Tiles shown inline before the profile defers to the achievements page. */
const MAX_UNLOCKED_TILES = 12

/** One number in the stat strip. */
function StatTile({
  icon,
  value,
  label,
  tone = 'text-primary',
}: {
  icon: React.ReactNode
  value: React.ReactNode
  label: string
  tone?: string
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 text-center shadow-card">
      <span className={`mx-auto mb-2 block w-fit ${tone}`}>{icon}</span>
      <p className="font-heading text-xl font-semibold text-deep">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}

/**
 * Add / accept / cancel / remove, driven by the relationship the friends context
 * already tracks.
 *
 * Deliberately reads from `relationshipFor` rather than fetching
 * `/friends/status/:id` on mount: the context is kept live by socket events, so
 * the button updates the moment the other side accepts — no reload, no refetch.
 */
function FriendActions({ userId, username }: { userId: string; username: string }) {
  const { relationshipFor, sendRequest, acceptRequest, declineRequest, cancelRequest, removeFriend } =
    useFriends()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)

  const relationship = relationshipFor(userId)
  if (relationship === 'self') return null

  const run = (action: () => Promise<void>) => async () => {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  if (relationship === 'friends') {
    return (
      <>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
            <UserCheck className="h-3.5 w-3.5" />
            Friends
          </span>
          <Button
            variant="secondary"
            icon={<UserMinus className="h-4 w-4" />}
            onClick={() => setConfirmRemove(true)}
            disabled={busy}
            className="!px-4 !py-2"
          >
            Remove
          </Button>
        </div>

        <ConfirmDialog
          open={confirmRemove}
          onClose={() => setConfirmRemove(false)}
          onConfirm={() => void run(() => removeFriend(userId))()}
          title={`Remove ${username}?`}
          message={`You will no longer be friends and neither of you can invite the other to a room. You can send a new request any time.`}
          confirmLabel="Remove friend"
          destructive
          confirmIcon={<UserMinus className="h-4 w-4" />}
        />
      </>
    )
  }

  if (relationship === 'request_received') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="w-full text-center text-xs text-muted sm:w-auto">
          {username} sent you a friend request
        </span>
        <div className="flex gap-2">
          <Button
            icon={<Check className="h-4 w-4" />}
            onClick={run(() => acceptRequest(userId))}
            loading={busy}
            className="!px-4 !py-2"
          >
            Accept
          </Button>
          <Button
            variant="secondary"
            icon={<X className="h-4 w-4" />}
            onClick={run(() => declineRequest(userId))}
            disabled={busy}
            className="!px-4 !py-2"
          >
            Decline
          </Button>
        </div>
      </div>
    )
  }

  if (relationship === 'request_sent') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-3 py-1.5 text-xs font-medium text-muted">
          <Clock className="h-3.5 w-3.5" />
          Request sent
        </span>
        <Button
          variant="ghost"
          onClick={run(() => cancelRequest(userId))}
          disabled={busy}
          className="!px-4 !py-2"
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button
      icon={<UserPlus className="h-4 w-4" />}
      onClick={run(() => sendRequest(userId, username))}
      loading={busy}
      className="!px-5 !py-2.5"
    >
      Add friend
    </Button>
  )
}

export default function Profile() {
  const { username } = useParams<{ username: string }>()
  const { user, logout, checkAuth } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
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
      <div className="mx-auto max-w-2xl px-4 py-12 flex justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-muted">User not found</p>
        <Link to="/" className="mt-4 inline-block">
          <Button>Go home</Button>
        </Link>
      </div>
    )
  }

  const stats = profile.stats
  const achievements = profile.achievements
  // rankTier arrives as a full division label ("Gold II"), so the palettes are
  // keyed through the helpers rather than by the label itself.
  const tierColor = rankColor(stats?.rankTier)
  const rankProgress = typeof stats?.rating === 'number' ? getRankProgress(stats.rating) : null
  const tierIcon = rankIcon(stats?.rankTier)
  const targetUserId: string | undefined = profile.user?.id
  const isOnline: boolean = !!profile.user?.isOnline
  const hasPlayed = Number(stats?.gamesPlayed ?? 0) > 0

  // Own profile carries locked achievements with progress; show the three closest
  // to done so there is something to aim at rather than a wall of grey.
  const nextUp: any[] = (achievements?.locked ?? [])
    .filter((ach: any) => ach.progress_target > 0)
    .sort(
      (a: any, b: any) =>
        b.progress_current / b.progress_target - a.progress_current / a.progress_target
    )
    .slice(0, 3)

  // The pinned three, and the rest of the pile minus them — a showcased
  // achievement appearing twice would read as a rendering bug.
  const showcase: any[] = achievements?.showcase ?? []
  const showcaseKeys = new Set(showcase.map((ach: any) => ach.key))
  const otherUnlocked: any[] = (achievements?.unlocked ?? []).filter(
    (ach: any) => !showcaseKeys.has(ach.key)
  )
  const restUnlocked = otherUnlocked.slice(0, MAX_UNLOCKED_TILES)
  const hiddenCount = otherUnlocked.length - restUnlocked.length

  const inputClass =
    'w-full rounded-button border border-border bg-surface-alt px-4 py-3   sm:text-sm text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary'

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:py-8">
      {/* Change username */}
      <Modal
        open={showUsernameModal}
        onClose={() => setShowUsernameModal(false)}
        title="Change username"
        subtitle="3–30 characters. Letters, numbers and underscores. Once every 2 days."
        size="sm"
      >
        <form onSubmit={handleUsernameChange} className="space-y-3">
          <input
            type="text"
            placeholder="New username"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            className={inputClass}
            autoFocus
          />
          {usernameError && <p className="text-sm text-accent">{usernameError}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowUsernameModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Change password */}
      <Modal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change password"
        size="sm"
      >
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            className={inputClass}
            required
          />
          <input
            type="password"
            placeholder="New password (6+ characters)"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className={inputClass}
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className={inputClass}
            required
          />
          {passwordError && <p className="text-sm text-accent">{passwordError}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowPasswordModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {!isOwnProfile && (
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-deep cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-card border border-border bg-surface shadow-card"
      >
        {/* Tier-tinted band, so the rank reads before you get to the words. */}
        <div
          className="h-16 w-full sm:h-20"
          style={{ background: `linear-gradient(120deg, ${tierColor}2E, ${tierColor}0A 65%, transparent)` }}
        />

        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="-mt-9 flex flex-col items-center text-center sm:-mt-10 sm:flex-row sm:items-end sm:text-left">
            <div className="relative">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-surface bg-surface-alt text-3xl sm:h-20 sm:w-20"
                style={{ backgroundColor: `${tierColor}1F` }}
              >
                {tierIcon}
              </div>
              {!isOwnProfile && (
                <span
                  title={isOnline ? 'Online now' : 'Offline'}
                  className={`absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-surface ${
                    isOnline ? 'bg-success' : 'bg-muted'
                  }`}
                />
              )}
            </div>

            <div className="mt-2 min-w-0 flex-1 sm:mb-1 sm:ml-4 sm:mt-0">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="font-heading text-2xl font-semibold text-deep break-all">
                  {profile.user.username}
                </h1>
                {isOwnProfile && (
                  <button
                    onClick={() => setShowUsernameModal(true)}
                    aria-label="Change username"
                    title="Change username"
                    className="rounded-button p-1.5 text-muted transition-colors hover:bg-surface-alt hover:text-deep cursor-pointer"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted sm:justify-start">
                {stats && <RankBadge label={stats.rankTier} size="sm" />}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Joined {format(new Date(profile.user.joinedDate), 'MMM yyyy')}
                </span>
                {!isOwnProfile && (
                  <span className="inline-flex items-center gap-1">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-success' : 'bg-muted'}`}
                    />
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Friend actions, or the account controls on your own profile. */}
          <div className="mt-4 border-t border-border pt-4">
            {!isOwnProfile && targetUserId ? (
              <FriendActions userId={targetUserId} username={profile.user.username} />
            ) : isOwnProfile ? (
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <Button
                  variant="secondary"
                  icon={<Lock className="h-4 w-4" />}
                  onClick={() => setShowPasswordModal(true)}
                  className="!px-4 !py-2"
                >
                  Change password
                </Button>
                <Button
                  variant="ghost"
                  icon={<LogOut className="h-4 w-4" />}
                  onClick={logout}
                  className="!px-4 !py-2"
                >
                  Log out
                </Button>
              </div>
            ) : (
              <p className="text-center text-xs text-muted">
                Friend actions are unavailable for this profile.
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* A brand-new account still has a real rank (Bronze III at 100 points), so
          the cards below always render — this is only the nudge on top of them. */}
      {!hasPlayed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.04 }}
          className="rounded-card border border-border bg-surface p-6 text-center shadow-card"
        >
          <Swords className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-2.5 text-sm text-deep">
            {isOwnProfile
              ? 'No competitive games yet'
              : `${profile.user.username} has not played competitive yet`}
          </p>
          {isOwnProfile && (
            <Link to="/play?mode=competitive" className="mt-4 inline-block">
              <Button>Play competitive</Button>
            </Link>
          )}
        </motion.div>
      )}

      {stats && (
        <>
          {/* ── Rank ────────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-6"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Current rank</p>
                <div className="mt-1.5">
                  <RankBadge label={stats.rankTier} size="md" />
                </div>
              </div>
              <div className="text-right">
                <span className="font-heading text-4xl font-bold text-deep sm:text-5xl">
                  {Number(stats.rating).toLocaleString()}
                </span>
                <span className="ml-1.5 text-sm text-muted">HuePoints</span>
              </div>
            </div>

            {rankProgress && (
              <div className="mt-4 space-y-1.5">
                <ProgressBar value={rankProgress.progress} color={tierColor} height={8} />
                <div className="flex justify-between text-xs text-muted">
                  <span className="font-mono">{rankProgress.floor.toLocaleString()}</span>
                  {rankProgress.nextTier === 'Max' ? (
                    <span className="font-medium text-deep">Top of the ladder</span>
                  ) : (
                    <span>
                      <span className="font-semibold text-deep">
                        {rankProgress.needed.toLocaleString()}
                      </span>{' '}
                      to {rankProgress.nextTier}
                    </span>
                  )}
                  <span className="font-mono">{(rankProgress.ceiling + 1).toLocaleString()}</span>
                </div>
              </div>
            )}
          </motion.div>

          {/* ── Stats ───────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-3"
          >
            <StatTile
              icon={<Target className="h-5 w-5" />}
              value={`${Math.round(Number(stats.avgAccuracy) || 0)}%`}
              label="Avg accuracy"
            />
            <StatTile
              icon={<Zap className="h-5 w-5" />}
              value={stats.bestStreak || 0}
              label="Best streak"
              tone="text-accent"
            />
            <StatTile
              icon={<Swords className="h-5 w-5" />}
              value={Number(stats.gamesPlayed).toLocaleString()}
              label="Games played"
              tone="text-success"
            />
          </motion.div>

          {/* ── Achievements ────────────────────────────────────────────────── */}
          {achievements?.unlocked?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-6"
            >
              <h3 className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wider text-muted">
                <Medal className="h-4 w-4" />
                Achievements
                <span className="font-mono text-deep">
                  {achievements.totalUnlocked}
                  {achievements.totalPossible ? `/${achievements.totalPossible}` : ''}
                </span>
              </h3>

              {/* Pinned first, at a size that reads as a choice rather than part
                  of the pile. Chosen on the achievements page. */}
              {showcase.length > 0 && (
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {showcase.map((ach: any) => (
                    <div
                      key={ach.key}
                      className="flex cursor-help flex-col items-center gap-1 rounded-xl border border-primary/25 bg-primary/5 p-3 text-center"
                      title={`${ach.name}: ${ach.description}`}
                    >
                      <div className="text-3xl">{ach.icon}</div>
                      <p className="max-w-full truncate text-[10px] font-semibold text-deep">
                        {ach.name}
                      </p>
                      {ach.points ? (
                        <p className="font-mono text-[9px] text-primary">{ach.points} pts</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {restUnlocked.map((ach: any) => (
                  <div
                    key={ach.key}
                    className="flex cursor-help flex-col items-center gap-1 rounded-xl bg-surface-alt p-2.5 text-center transition-colors hover:bg-surface-muted"
                    title={`${ach.name}: ${ach.description}`}
                  >
                    <div className="text-2xl">{ach.icon}</div>
                    <p className="max-w-full truncate text-[10px] font-medium text-deep">
                      {ach.name}
                    </p>
                  </div>
                ))}
              </div>

              {/* With a hundred achievements the full grid would be most of the
                  page, so it stops at a screenful and points at the real list. */}
              {hiddenCount > 0 && (
                <Link
                  to="/achievements"
                  className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                >
                  View all {achievements.totalUnlocked} unlocked →
                </Link>
              )}

              {isOwnProfile && nextUp.length > 0 && (
                <div className="mt-5 space-y-2.5 border-t border-border pt-4">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Closest to unlocking
                  </p>
                  {nextUp.map((ach: any) => (
                    <div key={ach.key} className="flex items-center gap-3">
                      <span className="text-lg opacity-40 grayscale">{ach.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-xs font-medium text-deep">{ach.name}</span>
                          <span className="shrink-0 font-mono text-[10px] text-muted">
                            {Math.min(ach.progress_current, ach.progress_target)}/
                            {ach.progress_target}
                          </span>
                        </div>
                        <ProgressBar
                          value={(ach.progress_current / ach.progress_target) * 100}
                          height={4}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Games by difficulty (own profile only) ──────────────────────── */}
          {profile.gamesByDifficulty?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-6"
            >
              <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-muted">
                Games by difficulty
              </h3>
              <div className="space-y-2">
                {profile.gamesByDifficulty.map((item: any) => (
                  <div key={item.difficulty} className="flex items-center justify-between">
                    <span className="text-sm capitalize text-deep">{item.difficulty}</span>
                    <span className="font-mono text-sm font-semibold text-deep">{item.count}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
