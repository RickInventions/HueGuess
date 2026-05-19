import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Coffee, Swords, ArrowRight, Trophy, User, Users, Calendar, 
  Search, Medal, Sparkles, TrendingUp, Crown, Target, Zap,
  GitFork, Palette 
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { leaderboard, achievements, user as userApi } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
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

// Skeleton Components
const TopPlayersSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center justify-between p-2 rounded-lg animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div>
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        <div className="text-right">
          <div className="h-5 w-10 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
          <div className="h-3 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    ))}
  </div>
)

const RecentAchievementsSkeleton = () => (
  <div className="space-y-2">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-surface-alt animate-pulse">
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="flex-1">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
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

  const handleCompetitiveClick = (e: React.MouseEvent) => {
    if (user && !isVerified) {
      e.preventDefault()
      toast.warning('Please verify your email to play Competitive mode', {
        action: {
          label: 'Verify',
          onClick: () => navigate('/verify'),
        },
      })
    }
  }

  const handleChallengeClick = (e: React.MouseEvent) => {
    if (user && !isVerified) {
      e.preventDefault()
      toast.warning('Please verify your email to play Challenge mode', {
        action: {
          label: 'Verify',
          onClick: () => navigate('/verify'),
        },
      })
    }
  }

  const handleDailyClick = (e: React.MouseEvent) => {
    if (user && !isVerified) {
      e.preventDefault()
      toast.warning('Please verify your email for Daily Challenge', {
        action: {
          label: 'Verify',
          onClick: () => navigate('/verify'),
        },
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Hero Section with Animated Gradient */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 animate-pulse" />
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
            
            {/* Global Stats Badges */}
            {!loading && globalStats && (
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{globalStats.totalPlayers.toLocaleString()} players</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm">
                  <Crown className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium">Top: {globalStats.topPlayer} ({globalStats.topScore} pts)</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-sm font-medium">Avg rating: {globalStats.avgRating}</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Game Modes */}
          <div className="lg:col-span-2 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {/* Daily Challenge */}
              <Link
                to={user ? (isVerified ? '/daily' : '#') : '/login'}
                onClick={handleDailyClick}
                className="block group"
              >
                <Card hover className="h-full border-l-4 border-l-primary transition-all duration-300 hover:scale-[1.02]">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-lg">Daily Challenge</h3>
                      <p className="text-muted text-sm">One new color every day. Compete globally.</p>
                    </div>
                  </div>
                </Card>
              </Link>

              {/* Casual */}
              <Link to="/play?mode=casual" className="block group">
                <Card hover className="h-full border-l-4 border-l-primary/50 transition-all duration-300 hover:scale-[1.02]">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Coffee className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-lg">Casual</h3>
                      <p className="text-muted text-sm">Relaxed play. No pressure. No sign-up needed.</p>
                    </div>
                  </div>
                </Card>
              </Link>

              {/* Competitive */}
              <Link
                to={user ? (isVerified ? '/play?mode=competitive' : '#') : '/login'}
                onClick={handleCompetitiveClick}
                className="block group"
              >
                <Card hover className="h-full border-l-4 border-l-accent transition-all duration-300 hover:scale-[1.02]">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors">
                      <Swords className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-lg">Competitive</h3>
                      <p className="text-muted text-sm">
                        {!user ? 'Sign in to compete.' : !isVerified ? 'Verify email to compete.' : 'Climb the leaderboard.'}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>

              {/* Challenge Mode */}
              {/* <Link
                to={user ? (isVerified ? '/challenge' : '#') : '/login?redirect=/challenge'}
                onClick={handleChallengeClick}
                className="block group"
              >
                <Card hover className="h-full border-l-4 border-l-purple-400 transition-all duration-300 hover:scale-[1.02]">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-purple-400/10 group-hover:bg-purple-400/20 transition-colors">
                      <Users className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-lg">Challenge</h3>
                      <p className="text-muted text-sm">
                        {!user ? 'Sign in to play with friends.' : !isVerified ? 'Verify email to play.' : 'Real-time multiplayer.'}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link> */}
<div className="block cursor-not-allowed">
  <Card className="h-full border-l-4 border-l-purple-400 transition-all duration-300">
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-xl bg-purple-400/10">
        <Users className="w-6 h-6 text-purple-500" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-heading font-semibold text-lg">Challenge</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            In Development
          </span>
        </div>
        <p className="text-muted text-sm">
          Real-time multiplayer — coming very soon!
        </p>
      </div>
    </div>
  </Card>
</div>
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
                    className="w-full pl-10 pr-4 py-3 rounded-button bg-surface-alt border border-border focus:outline-none focus:shadow-glow-primary transition-shadow"
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
                    <Trophy className="w-5 h-5 text-yellow-500" />
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
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                            idx === 1 ? 'bg-gray-400/20 text-gray-500' :
                            'bg-amber-600/20 text-amber-700'
                          }`}>
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
                      <h3 className="font-heading font-semibold">Recent Achievements</h3>
                    </div>
                    <Link to="/achievements" className="text-xs text-primary hover:underline">
                      View all →
                    </Link>
                  </div>
                  {loading ? (
                    <RecentAchievementsSkeleton />
                  ) : recentAchievements.length === 0 ? (
                    <p className="text-muted text-sm text-center py-4">
                      Play competitive games to earn achievements!
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
{/* Footer */}
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ delay: 0.8 }}
  className="text-center mt-12 pt-4 border-t border-border/30"
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