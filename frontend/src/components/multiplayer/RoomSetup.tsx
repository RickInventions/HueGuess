import { useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Eye, Play, Hash, Users } from 'lucide-react'
import { Button } from '../ui/Button'
import type { RoomConfig } from '../../types/multiplayer'
import type { Difficulty } from '../../types'

interface RoomSetupProps {
  /** Emits the exact config the server expects — no lossy mapping in between. */
  onCreate: (config: RoomConfig) => void
  loading?: boolean
  disabled?: boolean
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme']

export function RoomSetup({ onCreate, loading, disabled }: RoomSetupProps) {
  const [roundTimeSeconds, setRoundTimeSeconds] = useState(20)
  const [colorTimeSeconds, setColorTimeSeconds] = useState(3)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [roundsEnabled, setRoundsEnabled] = useState(false)
  const [roundsValue, setRoundsValue] = useState(5)

  const handleSubmit = () => {
    onCreate({
      roundTimeSeconds,
      colorTimeSeconds,
      difficulty,
      maxPlayers,
      specificRounds: roundsEnabled ? roundsValue : null,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <h3 className="font-heading text-xl font-semibold text-center">Create Room</h3>

      {/* Difficulty */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span aria-hidden>🎮</span>
          <span>Difficulty</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DIFFICULTIES.map((diff) => (
            <button
              key={diff}
              type="button"
              aria-pressed={difficulty === diff}
              onClick={() => setDifficulty(diff)}
              className={`px-2 py-2 text-xs rounded-button capitalize transition-all ${
                difficulty === diff
                  ? 'bg-primary text-white shadow-glow-primary'
                  : 'bg-surface-alt text-muted hover:text-deep'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>
      </div>

      {/* Max players */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Users className="w-4 h-4" />
          <span>Max Players</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[2, 3, 4].map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={maxPlayers === count}
              onClick={() => setMaxPlayers(count)}
              className={`px-2 py-2 text-xs rounded-button transition-all ${
                maxPlayers === count
                  ? 'bg-primary text-white shadow-glow-primary'
                  : 'bg-surface-alt text-muted hover:text-deep'
              }`}
            >
              {count} players
            </button>
          ))}
        </div>
      </div>

      {/* Round duration */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Clock className="w-4 h-4" />
            <span>Round Duration</span>
          </div>
          <span className="text-sm font-mono font-medium">{roundTimeSeconds}s</span>
        </div>
        <input
          title="Round Duration"
          type="range"
          min={10}
          max={40}
          value={roundTimeSeconds}
          onChange={(e) => setRoundTimeSeconds(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>10s</span>
          <span>40s</span>
        </div>
      </div>

      {/* Color visibility */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Eye className="w-4 h-4" />
            <span>Color Visibility</span>
          </div>
          <span className="text-sm font-mono font-medium">{colorTimeSeconds}s</span>
        </div>
        <input
          title="Color Visibility Duration"
          type="range"
          min={0.5}
          max={7}
          step={0.5}
          value={colorTimeSeconds}
          onChange={(e) => setColorTimeSeconds(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>0.5s</span>
          <span>7s</span>
        </div>
      </div>

      {/* Specific rounds */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Hash className="w-4 h-4" />
            <span>Specific Rounds</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={roundsEnabled}
            aria-label="Limit the game to a set number of rounds"
            onClick={() => setRoundsEnabled((v) => !v)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              roundsEnabled ? 'bg-primary' : 'bg-surface-alt border border-border'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                roundsEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {roundsEnabled ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-2 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Rounds</span>
              <span className="text-sm font-mono font-medium">{roundsValue}</span>
            </div>
            <input
              title="Number of Rounds"
              type="range"
              min={1}
              max={50}
              value={roundsValue}
              onChange={(e) => setRoundsValue(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted">
              <span>1</span>
              <span>50</span>
            </div>
          </motion.div>
        ) : (
          <p className="text-xs text-muted">Unlimited rounds — play until the host ends the session</p>
        )}
      </div>

      <Button
        fullWidth
        onClick={handleSubmit}
        loading={loading}
        disabled={disabled}
        icon={<Play className="w-4 h-4" />}
      >
        Create Room
      </Button>
    </motion.div>
  )
}
