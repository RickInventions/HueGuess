import { motion } from 'framer-motion'

interface ProgressBarProps {
  value: number       // 0-100
  max?: number
  color?: string
  bgColor?: string
  height?: number
  label?: string
  showValue?: boolean
  className?: string
}

export function ProgressBar({
  value,
  max = 100,
  color = '#5E60FF',
  bgColor = '#F1EEE7',
  height = 8,
  label,
  showValue = false,
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className={`w-full ${className}`}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs font-medium text-muted">{label}</span>}
          {showValue && (
            <span className="text-xs font-mono text-muted">
              {value}/{max}
            </span>
          )}
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height, backgroundColor: bgColor }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  )
}