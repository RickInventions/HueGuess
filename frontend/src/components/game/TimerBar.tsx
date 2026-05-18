interface TimerBarProps {
  percentage: number
  isWarning: boolean
  label: string
  phase: 'memorize' | 'reconstruct'
}

export function TimerBar({ percentage, isWarning, label, phase }: TimerBarProps) {
  return (
    <div className="w-full space-y-1.5">
      {/* Label */}
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-muted uppercase tracking-wider">
          {label}
        </span>
        {phase === 'reconstruct' && (
          <span
            className={`text-xs font-mono font-medium ${
              isWarning ? 'text-accent' : 'text-muted'
            }`}
          >
            {Math.ceil((percentage / 100) * 30)}s left
          </span>
        )}
      </div>

      {/* Track */}
      <div className="w-full h-1.5 rounded-full bg-surface-alt overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-100 ease-linear"
          style={{
            width: `${percentage}%`,
            backgroundColor: isWarning
              ? '#FF7A59'
              : phase === 'memorize'
              ? '#5E60FF'
              : '#1FC98E',
          }}
        />
      </div>
    </div>
  )
}