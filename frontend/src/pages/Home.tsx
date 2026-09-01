import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Coffee, Swords, ArrowRight, Trophy, User, Users, Calendar,
  Search, Medal, TrendingUp, Crown, Lock, FlipHorizontal2, EyeOff
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { leaderboard, achievements, user as userApi } from '../lib/api'
import { Card } from '../components/ui/Card'
import { toast } from 'sonner'

interface GlobalStats {
  totalPlayers: number
  avgRating: number
  highestRating: number
  topPlayer: string
  topScore: number
}

interface TopPlayer {
  rank: number
  username: string
  rating: number
  rankTier: string
}

interface RecentAchievement {
  key: string
  name: string
  icon: string
  unlocked_at: string
}

interface Mode {
  key: string
  name: string
  blurb: string
  /** Shown instead of `blurb` when nobody is signed in. */
  signedOutBlurb?: string
  Icon: LucideIcon
  to: string
  signedOutTo: string
  /** Needs a verified email. */
  gated: boolean
  border: string
  chip: string
  tint: string
}

/**
 * Every mode, as data rather than six near-identical JSX blocks.
 *
 * Tailwind classes are written out in full — the JIT compiler scans source text,
 * so a class assembled from a variable would never make it into the stylesheet.
 */
const MODES: Mode[] = [
  {
    key: 'daily',
    name: 'Daily Challenge',
    blurb: 'One new color every day. Compete globally.',
    signedOutBlurb: 'Sign in to play the daily color.',
    Icon: Calendar,
    to: '/daily',
    signedOutTo: '/login',
    gated: true,
    border: 'border-l-primary',
    chip: 'bg-primary/10 group-hover:bg-primary/20',
    tint: 'text-primary',
  },
  {
    key: 'casual',
    name: 'Casual',
    blurb: 'Relaxed play. No pressure. No sign-up needed.',
    Icon: Coffee,
    to: '/play?mode=casual',
    signedOutTo: '/play?mode=casual',
    gated: false,
    border: 'border-l-primary/40',
    chip: 'bg-primary/10 group-hover:bg-primary/20',
    tint: 'text-primary',
  },
  {
    key: 'competitive',
    name: 'Competitive',
    blurb: 'Climb the leaderboard.',
    signedOutBlurb: 'Sign in to compete.',
    Icon: Swords,
    to: '/play?mode=competitive',
    signedOutTo: '/login',
    gated: true,
    border: 'border-l-accent',
    chip: 'bg-accent/10 group-hover:bg-accent/20',
    tint: 'text-accent',
  },
  {
    key: 'challenge',
    name: 'Challenge',
    // Point and percentage scoring both live in here, chosen when a room is
    // created — one card, two scoring rules.
    blurb: 'Real-time multiplayer, scored on points or percentage.',
    signedOutBlurb: 'Sign in to play with friends.',
    Icon: Users,
    to: '/challenge',
    signedOutTo: '/login?redirect=/challenge',
    gated: true,
    border: 'border-l-success',
    chip: 'bg-success/10 group-hover:bg-success/20',
    tint: 'text-success',
  },
  {
    key: 'inverted',
    name: 'Inverted',
    blurb: 'The colour and the page arrive flipped. Rebuild the original.',
    signedOutBlurb: 'Sign in to play inverted.',
    Icon: FlipHorizontal2,
    to: '/modes/inverted',
    signedOutTo: '/login?redirect=/modes/inverted',
    gated: true,
    border: 'border-l-deep',
    chip: 'bg-deep/10 group-hover:bg-deep/20',
    tint: 'text-deep',
  },
  {
    key: 'blind',
    name: 'Blind',
    blurb: 'Guess a colour you never saw, or rebuild one with grey sliders.',
    signedOutBlurb: 'Sign in to play blind.',
    Icon: EyeOff,
    to: '/modes/blind',
    signedOutTo: '/login?redirect=/modes/blind',
    gated: true,
    border: 'border-l-muted',
    chip: 'bg-muted/10 group-hover:bg-muted/20',
    tint: 'text-muted',
  },
]

/** Descending prominence for the top three, in theme tokens. */
const MEDALS = [
  'bg-accent/15 text-accent',
  'bg-primary/15 text-primary',
  'bg-surface-muted text-muted',
]

// Skeleton Components
const TopPlayersSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center justify-between p-2 rounded-lg animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-surface-muted" />
          <div>
            <div className="h-4 w-24 bg-surface-muted rounded mb-1" />
            <div className="h-3 w-16 bg-surface-muted rounded" />
          </div>
        </div>
        <div className="text-right">
          <div className="h-5 w-10 bg-surface-muted rounded mb-1" />
          <div className="h-3 w-8 bg-surface-muted rounded" />
        </div>
      </div>
    ))}
  </div>
)

const RecentAchievementsSkeleton = () => (
  <div className="space-y-2">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-surface-alt animate-pulse">
        <div className="w-8 h-8 bg-surface-muted rounded-full" />
        <div className="flex-1">
          <div className="h-4 w-32 bg-surface-muted rounded mb-1" />
          <div className="h-3 w-20 bg-surface-muted rounded" />
        </div>
      </div>
    ))}
  </div>
)

export default function Home() {
  const { user, isVerified } = useAuth()
  const navigate = useNavigate()
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([])
  const [recentAchievements, setRecentAchievements] = useState<RecentAchievement[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const [statsRes, topRes, achievRes] = await Promise.all([
          leaderboard.getGlobalStats(),
          leaderboard.getTopPlayers(3),
          user ? achievements.getRecent() : Promise.resolve({ data: { recent: [] } })
        ])
        setGlobalStats(statsRes.data.stats)
        setTopPlayers(topRes.data.leaderboard?.entries || [])
        setRecentAchievements(achievRes.data.recent || [])
      } catch (error) {
        console.error('Failed to fetch home data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchHomeData()
  }, [user])

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setShowSearchDropdown(false)
      return
    }
    setSearching(true)
    try {
      const res = await userApi.searchUsers(query, 5)
      setSearchResults(res.data.results)
      setShowSearchDropdown(true)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setSearching(false)
    }
  }

  /**
   * Blocks a gated mode for a signed-in-but-unverified account.
   *
   * Signed-out visitors fall through — their link already points at /login.
   */
  const requireVerified = (label: string, e: React.MouseEvent) => {
    if (user && !isVerified) {
      e.preventDefault()
      toast.warning(`Verify your email to play ${label}`, {
        action: {
          label: 'Verify',
          onClick: () => navigate('/verify'),
        },
      })
    }
  }

  // One obvious entry point, rather than four cards of equal weight.
  const primaryCta = user && isVerified
    ? { to: '/daily', label: "Play today's color" }
    : { to: '/play?mode=casual', label: user ? 'Play casual' : 'Play now' }

  const secondaryCta = user
    ? isVerified
      ? { to: '/play?mode=casual', label: 'Casual mode' }
      : { to: '/verify', label: 'Verify email' }
    : { to: '/login', label: 'Sign in' }

  return (
    <div className="min-h-screen bg-base">
      {/* Hero. The gradient wash is static — an always-animating full-bleed layer
          gets its own compositing layer and flickers on mobile. */}
      {/* `border` is already rgba(...,0.05), so no opacity modifier — Tailwind
          rewrites the alpha channel and /60 would draw a hard black rule. */}
      <div className="relative overflow-hidden border-b border-border bg-surface">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.07] via-accent/[0.04] to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="font-heading text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-4">
              Train your
              <br />
              <span className="text-deep">color memory.</span>
            </h1>
            <p className="text-muted text-lg max-w-md mx-auto text-balance mb-8">
              Memorize a color, then reconstruct it from memory.
              How accurate are your eyes?
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <Link
                to={primaryCta.to}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-button font-heading font-medium text-sm bg-deep text-white hover:bg-deep/90 transition-colors"
              >
                {primaryCta.label}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to={secondaryCta.to}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-button font-heading font-medium text-sm bg-surface-alt text-deep border border-border hover:bg-surface-muted transition-colors"
              >
                {secondaryCta.label}
              </Link>
            </div>

            {/* Global Stats Badges */}
            {!loading && globalStats && (
              <div className="flex flex-wrap justify-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-full shadow-sm">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{globalStats.totalPlayers.toLocaleString()} players</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-full shadow-sm">
                  <Crown className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium">Top: {globalStats.topPlayer} ({globalStats.topScore} pts)</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-full shadow-sm">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-sm font-medium">Avg rating: {globalStats.avgRating}</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Game Modes */}
          <div className="lg:col-span-2 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {MODES.map(mode => {
                const needsVerify = !!user && mode.gated && !isVerified
                const to = user ? (needsVerify ? '#' : mode.to) : mode.signedOutTo
                const blurb = user ? mode.blurb : (mode.signedOutBlurb ?? mode.blurb)

                return (
                  <Link
                    key={mode.key}
                    to={to}
                    onClick={mode.gated ? (e => requireVerified(mode.name, e)) : undefined}
                    className="block group"
                  >
                    <Card
                      hover
                      className={`h-full border-l-4 ${mode.border} transition-all duration-300 hover:scale-[1.02]`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl transition-colors ${mode.chip}`}>
                          <mode.Icon className={`w-6 h-6 ${mode.tint}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-heading font-semibold text-lg">{mode.name}</h3>
                            {/* Locked state is a badge, not reduced opacity — faded
                                text on this palette lands near 2.3:1. */}
                            {needsVerify && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-muted text-[10px] font-semibold uppercase tracking-wide text-deep">
                                <Lock className="w-2.5 h-2.5" />
                                Verify
                              </span>
                            )}
                          </div>
                          <p className="text-muted text-sm">{blurb}</p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </motion.div>

            {/* User Search Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <Card className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    placeholder="Search for a player..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      handleSearch(e.target.value)
                    }}
                    onFocus={() => searchQuery && setShowSearchDropdown(true)}
                    className="w-full pl-10 pr-4 py-3 rounded-button bg-surface-alt border border-border   sm:text-sm focus:outline-none focus:shadow-glow-primary transition-shadow"
                  />
                  {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {showSearchDropdown && searchResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute left-0 right-0 mt-2 bg-surface rounded-xl shadow-lg border border-border z-10 overflow-hidden"
                    >
                      {searchResults.map((result) => (
                        <Link
                          key={result.id}
                          to={`/profile/${result.username}`}
                          onClick={() => setShowSearchDropdown(false)}
                          className="flex items-center justify-between px-4 py-3 hover:bg-surface-alt transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{result.username}</p>
                              <p className="text-xs text-muted">{result.rating || 0} HuePoints</p>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted" />
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          </div>

          {/* Right Column: Leaderboard Preview & Achievements */}
          <div className="space-y-4">
            {/* Top 3 Leaderboard Preview */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-accent" />
                    <h3 className="font-heading font-semibold">Top Players</h3>
                  </div>
                  <Link to="/leaderboard" className="text-xs text-primary hover:underline">
                    View all →
                  </Link>
                </div>
                {loading ? (
                  <TopPlayersSkeleton />
                ) : topPlayers.length === 0 ? (
                  <p className="text-muted text-sm text-center py-4">No players yet</p>
                ) : (
                  <div className="space-y-3">
                    {topPlayers.map((player, idx) => (
                      <Link
                        key={player.username}
                        to={`/profile/${player.username}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-alt transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              MEDALS[idx] ?? MEDALS[2]
                            }`}
                          >
                            #{player.rank}
                          </div>
                          <div>
                            <p className="font-medium">{player.username}</p>
                            <p className="text-xs text-muted">{player.rankTier}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-heading font-semibold">{player.rating}</p>
                          <p className="text-xs text-muted">pts</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Recent Achievements (if logged in) */}
            {user && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Medal className="w-5 h-5 text-accent" />
                      <h3 className="font-heading font-semibold">New Achievements</h3>
                    </div>
                    <Link to="/achievements" className="text-xs text-primary hover:underline">
                      View all →
                    </Link>
                  </div>
                  {loading ? (
                    <RecentAchievementsSkeleton />
                  ) : recentAchievements.length === 0 ? (
                    <p className="text-muted text-sm text-center py-4">
                      Nothing new — play a game to unlock more.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recentAchievements.slice(0, 3).map((ach) => (
                        <div key={ach.key} className="flex items-center gap-3 p-2 rounded-lg bg-surface-alt">
                          <div className="text-2xl">{ach.icon}</div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{ach.name}</p>
                            <p className="text-xs text-muted">
                              {new Date(ach.unlocked_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </motion.div>
            )}

            {/* Quick Stats for Logged In Users */}
            {user && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
              >
                <Link to="/profile">
                  <Card hover className="p-4 group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted">Your Profile</p>
                          <p className="font-heading font-semibold">{user.username}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted group-hover:text-deep transition-colors" />
                    </div>
                  </Card>
                </Link>
              </motion.div>
            )}
          </div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-12 pt-4 border-t border-border"
        >
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 text-xs text-muted">
            <span className="whitespace-nowrap">No sign-up required for casual mode.</span>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
              <Link
                to="/leaderboard"
                className="hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-primary/5"
              >
                Leaderboard
              </Link>
              <Link
                to="/achievements"
                className="hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-primary/5"
              >
                Achievements
              </Link>
              <Link
                to="/faq"
                className="font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-md hover:bg-primary/5"
              >
                FAQ
              </Link>
              <Link
                to="/support"
                className="hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-primary/5"
              >
                Support
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
