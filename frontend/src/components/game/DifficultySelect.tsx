import { motion } from 'framer-motion'
import { Clock, Zap, Skull } from 'lucide-react'
import { Card } from '../ui/Card'
import type { Difficulty } from '../../types'

interface DifficultyOption {
  id: Difficulty
  label: string
  description: string
  icon: typeof Clock
  multiplier: number
  memorizeTime: number
  color: string
  locked?: boolean
  lockReason?: string
}

interface DifficultySelectProps {
  onSelect: (difficulty: Difficulty) => void
  unlockedDifficulties: string[]
  currentTier?: string
}

const DIFFICULTIES: DifficultyOption[] = [
  {
    id: 'easy',
    label: 'Easy',
    description: '4s to memorize. Entry-level.',
    icon: Clock,
    multiplier: 1.5,
    memorizeTime: 4,
    color: '#1FC98E',
  },
  {
    id: 'medium',
    label: 'Medium',
    description: '3s to memorize. Standard competitive.',
    icon: Zap,
    multiplier: 1.0,
    memorizeTime: 3,
    color: '#5E60FF',
  },
  {
    id: 'hard',
    label: 'Hard',
    description: '1s to memorize. High risk, 3x reward.',
    icon: Skull,
    multiplier: 3.0,
    memorizeTime: 1,
    color: '#FF7A59',
    locked: false, // overridden by props
  },
]

export function DifficultySelect({ onSelect, unlockedDifficulties, currentTier }: DifficultySelectProps) {
  const options = DIFFICULTIES.map((d) => ({
    ...d,
    locked: !unlockedDifficulties.includes(d.id),
    lockReason:
      d.id === 'hard' && !unlockedDifficulties.includes('hard')
        ? `Unlocks at Gold (you're ${currentTier || 'Bronze'})`
        : undefined,
  }))

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted mb-4">Select difficulty</p>
      {options.map((option, i) => (
        <motion.div
          key={option.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
        >
          <Card
            hover={!option.locked}
            className={`group ${option.locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
                <div className="flex items-center gap-2">
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
              <span className="text-xs text-muted font-mono">{option.memorizeTime}s</span>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}