import { motion } from 'framer-motion'
import { Clock, Zap, Skull, AlertTriangle } from 'lucide-react'
import { Card } from '../ui/Card'
import type { Difficulty } from '../../types'

interface DifficultyOption {
  id: Difficulty
  label: string
  description: string
  icon: typeof Clock
  multiplier: number
  colorTimeSeconds: number
  roundTimeSeconds: number
  color: string
}

interface DifficultySelectProps {
  onSelect: (difficulty: Difficulty) => void
  unlockedDifficulties: string[]
  currentTier?: string
  mode?: 'casual' | 'competitive'
}

const DIFFICULTIES: DifficultyOption[] = [
  {
    id: 'easy',
    label: 'Easy',
    description: '6s memorization, 35s reconstruction',
    icon: Clock,
    multiplier: 1.0,
    colorTimeSeconds: 6,
    roundTimeSeconds: 35,
    color: '#1FC98E',
  },
  {
    id: 'medium',
    label: 'Medium',
    description: '4s memorization, 30s reconstruction',
    icon: Zap,
    multiplier: 1.5,
    colorTimeSeconds: 4,
    roundTimeSeconds: 30,
    color: '#5E60FF',
  },
  {
    id: 'hard',
    label: 'Hard',
    description: '2s memorization, 15s reconstruction',
    icon: Skull,
    multiplier: 2.0,
    colorTimeSeconds: 2,
    roundTimeSeconds: 15,
    color: '#FF7A59',
  },
  {
    id: 'extreme',
    label: 'Extreme',
    description: '0.5s memorization, 15s reconstruction',
    icon: AlertTriangle,
    multiplier: 4.0,
    colorTimeSeconds: 0.5,
    roundTimeSeconds: 15,
    color: '#FF2D55',
  },
]

export function DifficultySelect({ onSelect, unlockedDifficulties, currentTier, mode = 'casual' }: DifficultySelectProps) {
  // In casual mode, all difficulties are unlocked
  const options = DIFFICULTIES.map((d) => ({
    ...d,
    locked: mode === 'competitive' ? !unlockedDifficulties.includes(d.id) : false,
    lockReason:
      mode === 'competitive' && !unlockedDifficulties.includes(d.id)
        ? `Unlocks at ${d.id === 'hard' ? 'Gold' : d.id === 'extreme' ? 'Platinum' : ''} (you're ${currentTier || 'Bronze'})`
        : undefined,
  }))

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="font-heading text-lg font-semibold text-deep mb-1">Select Difficulty</h3>
        <p className="text-sm text-muted">
          {mode === 'casual' 
            ? 'All difficulties are unlocked for casual play' 
            : 'Unlock harder difficulties by climbing ranks'}
        </p>
      </div>

      <div className="space-y-3">
        {options.map((option, i) => (
          <motion.div
            key={option.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card
              hover={!option.locked}
              className={`group ${option.locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => !option.locked && onSelect(option.id)}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${option.color}15` }}
                >
                  <option.icon className="w-5 h-5" style={{ color: option.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-heading font-semibold text-sm">{option.label}</h4>
                    <span
                      className="text-xs font-mono px-1.5 py-0.5 rounded-md"
                      style={{ backgroundColor: `${option.color}10`, color: option.color }}
                    >
                      {option.multiplier}x
                    </span>
                    {option.locked && (
                      <span className="text-xs text-muted">🔒</span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {option.locked ? option.lockReason : option.description}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted font-mono block">{option.colorTimeSeconds}s</span>
                  <span className="text-xs text-muted font-mono">/{option.roundTimeSeconds}s</span>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}