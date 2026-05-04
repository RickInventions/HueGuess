import { motion } from 'framer-motion'

const COLOR_CHIPS = [
  { color: '#5E60FF', size: 120, x: '10%', y: '20%', delay: 0 },
  { color: '#FF7A59', size: 80, x: '85%', y: '15%', delay: 5 },
  { color: '#1FC98E', size: 100, x: '75%', y: '70%', delay: 10 },
  { color: '#FFD700', size: 90, x: '15%', y: '75%', delay: 3 },
  { color: '#5E60FF', size: 60, x: '50%', y: '50%', delay: 7 },
  { color: '#FF7A59', size: 110, x: '30%', y: '40%', delay: 12 },
]

export function BackgroundAmbience() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {COLOR_CHIPS.map((chip, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{
            left: chip.x,
            top: chip.y,
            width: chip.size,
            height: chip.size,
            backgroundColor: chip.color,
            opacity: 0.08,
          }}
          animate={{
            y: [0, -30, -15, -40, 0],
            x: [0, 15, -10, 5, 0],
            scale: [1, 1.1, 0.95, 1.05, 1],
          }}
          transition={{
            duration: 25 + chip.delay,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: chip.delay,
          }}
        />
      ))}
    </div>
  )
}