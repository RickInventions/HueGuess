import { useRef, useCallback, type ReactNode } from 'react'

interface SliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  icon?: ReactNode
  className?: string
  trackStyle?: React.CSSProperties
  disabled?: boolean 
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  icon,
  className = '',
  trackStyle,
  disabled = false,  // ✅ Default to false
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  const percentage = ((value - min) / (max - min)) * 100

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return  // ✅ Prevent interaction when disabled
      
      const track = trackRef.current
      if (!track) return

      const updateValue = (clientX: number) => {
        const rect = track.getBoundingClientRect()
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
        const pct = x / rect.width
        const newValue = min + pct * (max - min)
        onChange(Math.round(newValue / step) * step)
      }

      updateValue(e.clientX)

      const handleMove = (moveEvent: PointerEvent) => {
        updateValue(moveEvent.clientX)
      }

      const handleUp = () => {
        document.removeEventListener('pointermove', handleMove)
        document.removeEventListener('pointerup', handleUp)
      }

      document.addEventListener('pointermove', handleMove)
      document.addEventListener('pointerup', handleUp)
    },
    [min, max, step, onChange, disabled]  // ✅ Add disabled to deps
  )

  return (
    <div className={`w-full ${className}`}>
      {(label || icon) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-xs font-medium text-muted uppercase tracking-wider">{label}</span>}
          {icon && <span className="text-muted">{icon}</span>}
        </div>
      )}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        className={`relative h-8 rounded-slider cursor-pointer touch-none select-none transition-opacity ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        style={{
          background: trackStyle?.background || '#F1EEE7',
          ...trackStyle,
        }}
      >
        {/* Filled track */}
        <div
          className="absolute top-0 left-0 h-full rounded-slider opacity-30 pointer-events-none"
          style={{
            width: `${percentage}%`,
            background: 'currentColor',
          }}
        />
        {/* Handle */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-white shadow-slider-handle pointer-events-none transition-shadow ${
            disabled ? 'opacity-50' : ''
          }`}
          style={{
            left: `${percentage}%`,
          }}
        />
      </div>
    </div>
  )
}