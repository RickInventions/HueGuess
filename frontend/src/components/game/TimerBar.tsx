import { useEffect } from 'react'
import { soundService } from '../../services/soundService'

interface TimerBarProps {
  timeRemaining: number
  totalTime: number
  label: string
  isUrgent?: boolean
}

export function TimerBar({ timeRemaining, totalTime, label, isUrgent }: TimerBarProps) {
  const percentage = totalTime > 0 ? (timeRemaining / totalTime) * 100 : 0

  const getColor = () => {
    if (isUrgent) return 'bg-accent'
    if (label.includes('Memorize')) return 'bg-primary'
    return 'bg-success'
  }

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm font-medium mb-2">
        <span>{label}</span>
        <span className={isUrgent ? 'text-accent font-bold animate-pulse' : 'text-muted'}>
          {Math.max(0, Math.ceil(timeRemaining))}s
        </span>
      </div>
      <div className="h-3 bg-surface-alt rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${getColor()}`}
          style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
        />
      </div>
    </div>
  )
}