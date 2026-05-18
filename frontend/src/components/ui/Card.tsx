import { motion, type HTMLMotionProps } from 'framer-motion'
import { type ReactNode } from 'react'

interface CardProps extends HTMLMotionProps<'div'> {
  children: ReactNode
  hover?: boolean
  className?: string
}

export function Card({ children, hover = false, className = '', ...props }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.06)' } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`
        bg-surface border border-border
        rounded-card p-6
        shadow-card
        ${hover ? 'cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  )
}