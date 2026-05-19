import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Medal, Lock } from 'lucide-react'
import { achievements } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/ProgressBar'

export default function Achievements() {
  const { user } = useAuth()
  const [unlocked, setUnlocked] = useState<any[]>([])
  const [locked, setLocked] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAchievements = async () => {
      if (!user) {
        // For non-authenticated, just show all achievements as locked
        try {
          const res = await achievements.getAll()
          const all = res.data.achievements
          setLocked(all.map((a: any) => ({ ...a, progress_current: 0, progress_target: a.requirement_value })))
          setUnlocked([])
          setStats({ total: 0, totalPossible: all.length })
        } catch (error) {
          console.error(error)
        } finally {
          setLoading(false)
        }
        return
      }

      try {
        const res = await achievements.getMine()
        setUnlocked(res.data.unlocked)
        setLocked(res.data.locked)
        setStats(res.data.stats)
      } catch (error) {
        console.error('Failed to load achievements:', error)
      } finally {
        setLoading(false)
      }
    }
    loadAchievements()
  }, [user])

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'accuracy': return '🎯'
      case 'streak': return '🔥'
      case 'games': return '🎮'
      case 'elo': return '🏆'
      case 'modes': return '⚔️'
      case 'multiplayer': return '👥'
      default: return '🏅'
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="font-heading text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Achievements
        </h1>
        {user && stats && (
          <p className="text-muted mt-2">
            {stats.total} / {stats.totalPossible} unlocked
          </p>
        )}
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Unlocked Achievements */}
          {unlocked.length > 0 && (
            <div className="mb-8">
              <h2 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
                <Medal className="w-5 h-5 text-success" />
                Unlocked
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {unlocked.map((ach) => (
                  <motion.div
                    key={ach.key}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="p-4 border-l-4 border-l-success bg-success/5">
                      <div className="flex items-start gap-3">
                        <div className="text-3xl">{ach.icon}</div>
                        <div className="flex-1">
                          <h3 className="font-heading font-semibold">{ach.name}</h3>
                          <p className="text-xs text-muted">{ach.description}</p>
                          <p className="text-xs text-success mt-1">Unlocked</p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Locked Achievements */}
          {locked.length > 0 && (
            <div>
              <h2 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-muted" />
                Locked
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {locked.map((ach) => (
                  <Card key={ach.key} className="p-4 opacity-70">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl filter grayscale">{ach.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-heading font-semibold">{ach.name}</h3>
                        <p className="text-xs text-muted">{ach.description}</p>
                        {ach.progress_target && (
                          <div className="mt-2">
                            <ProgressBar
                              value={(ach.progress_current / ach.progress_target) * 100}
                              height={4}
                              color="#9CA3AF"
                            />
                            <p className="text-xs text-muted mt-1">
                              {ach.progress_current} / {ach.progress_target}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}