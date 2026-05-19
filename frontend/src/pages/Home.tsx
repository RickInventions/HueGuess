import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Coffee, Swords, ArrowRight, Trophy, User, Users, Calendar } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui/Card'
import { toast } from 'sonner'

export default function Home() {
  const { user, isVerified } = useAuth()

  const handleCompetitiveClick = (e: React.MouseEvent) => {
    if (user && !isVerified) {
      e.preventDefault()
      toast.warning('Please verify your email to play Competitive mode', {
        action: {
          label: 'Verify',
          onClick: () => window.location.href = '/verify',
        },
      })
    }
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] flex flex-col items-center justify-center px-4 py-12">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h1 className="font-heading text-hero text-deep text-balance mb-4">
          Train your
          <br />
          <span className="text-primary">color memory.</span>
        </h1>
        <p className="text-muted text-lg max-w-md mx-auto text-balance">
          Memorize a color, then reconstruct it from memory.
          How accurate are your eyes?
        </p>
      </motion.div>

      {/* Mode Cards */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full max-w-md space-y-3"
      >
        {/* Daily Challenge */}
<Link
  to={user ? (isVerified ? '/daily' : '#') : '/login'}
  className="block no-drag"
  onClick={(e) => {
    if (user && !isVerified) {
      e.preventDefault()
      toast.warning('Please verify your email to play Daily Challenge', {
        action: {
          label: 'Verify',
          onClick: () => window.location.href = '/verify',
        },
      })
    }
  }}
>
  <Card hover className="group border-l-4 border-l-primary/40">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-heading font-semibold">Daily Challenge</h3>
          <p className="text-muted text-sm">
            {!user 
              ? 'Sign in to play.' 
              : !isVerified 
                ? 'Verify email to play.'
                : 'One new color every day.'}
          </p>
        </div>
      </div>
      <ArrowRight className="w-5 h-5 text-muted group-hover:text-deep transition-colors" />
    </div>
  </Card>
</Link>
        {/* Casual */}
        <Link to="/play?mode=casual" className="block no-drag">
          <Card hover className="group border-l-4 border-l-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Coffee className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold">Casual</h3>
                  <p className="text-muted text-sm">Relaxed play. No pressure.</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted group-hover:text-deep transition-colors" />
            </div>
          </Card>
        </Link>

        {/* Competitive */}
        <Link
          to={user ? (isVerified ? '/play?mode=competitive' : '#') : '/login'}
          className="block no-drag"
          onClick={handleCompetitiveClick}
        >
          <Card hover className="group border-l-4 border-l-accent/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-accent/10 flex items-center justify-center">
                  <Swords className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold">Competitive</h3>
                  <p className="text-muted text-sm">
                    {!user 
                      ? 'Sign in to compete.' 
                      : !isVerified 
                        ? 'Verify email to compete.' 
                        : 'Climb the leaderboard.'}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted group-hover:text-deep transition-colors" />
            </div>
          </Card>
        </Link>
        
        <Link
          to={user ? (isVerified ? '/challenge' : '#') : '/login?redirect=/challenge'}
          className="block no-drag"
          onClick={(e) => {
            if (user && !isVerified) {
              e.preventDefault()
              toast.warning('Please verify your email to play Challenge mode', {
                action: {
                  label: 'Verify',
                  onClick: () => window.location.href = '/verify',
                },
              })
            }
          }}
        >
          <Card hover className="group border-l-4 border-l-purple-400/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-purple-400/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold">Challenge</h3>
                  <p className="text-muted text-sm">
                    {!user 
                      ? 'Sign in to play with friends.' 
                      : !isVerified 
                        ? 'Verify email to play with friends.'
                        : 'Play with friends in real-time.'}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted group-hover:text-deep transition-colors" />
            </div>
          </Card>
        </Link>

        {/* Leaderboard */}
        <Link to="/leaderboard" className="block no-drag">
          <Card hover className="group border-l-4 border-l-yellow-400/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-yellow-400/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold">Leaderboard</h3>
                  <p className="text-muted text-sm">See the top players.</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted group-hover:text-deep transition-colors" />
            </div>
          </Card>
        </Link>

        {/* Profile (if logged in) */}
        {user && (
          <Link to="/profile" className="block no-drag">
            <Card hover className="group border-l-4 border-l-muted/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-muted/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-muted" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold">Profile</h3>
                    <p className="text-muted text-sm">View your stats & tier.</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted group-hover:text-deep transition-colors" />
              </div>
            </Card>
          </Link>
        )}
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-12 text-xs text-muted"
      >
        No sign-up required for casual mode.
      </motion.p>
    </div>
  )
}