import { motion } from 'framer-motion'
import { Medal } from 'lucide-react'
import type { RoundResult } from '../../types'

interface RoundResultsProps {
  results: RoundResult[]
  timedOut: boolean
}

function hslString(c: { h: number; s: number; l: number }): string {
  return `hsl(${c.h}, ${c.s}%, ${c.l}%)`
}

export function RoundResults({ results, timedOut }: RoundResultsProps) {
  const sorted = [...results].sort((a, b) => b.accuracy - a.accuracy)

  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="font-heading text-lg font-semibold">Round Results</h3>
        {timedOut && (
          <p className="text-xs text-muted">Round ended — time ran out</p>
        )}
      </div>

      {sorted.map((result, i) => (
        <motion.div
          // key={result.username}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border"
        >
          {/* Rank */}
          <div className="w-8 text-center">
            {i === 0 && <Medal className="w-5 h-5 text-yellow-500 mx-auto" />}
            {i === 1 && <Medal className="w-5 h-5 text-gray-400 mx-auto" />}
            {i === 2 && <Medal className="w-5 h-5 text-amber-700 mx-auto" />}
            {i > 2 && <span className="text-sm font-medium text-muted">#{i + 1}</span>}
          </div>

          {/* Colors */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className="w-6 h-6 rounded-md border border-border shrink-0"
              style={{ backgroundColor: hslString(result.originalColor) }}
            />
            <span className="text-xs text-muted">→</span>
            <div
              className="w-6 h-6 rounded-md border border-border shrink-0"
              style={{ backgroundColor: hslString(result.userColor) }}
            />
            {/* <span className="font-medium text-sm truncate ml-2">{result.username}</span> */}
          </div>

          {/* Accuracy */}
          <span className="font-heading font-semibold text-sm">
            {result.accuracy}%
          </span>
        </motion.div>
      ))}
    </div>
  )
}