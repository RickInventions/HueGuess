import { motion, type HTMLMotionProps } from 'framer-motion'
import { type ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode
  variant?: ButtonVariant
  icon?: ReactNode
  fullWidth?: boolean
  loading?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-deep text-white hover:bg-deep/90',
  secondary: 'bg-surface-alt text-deep hover:bg-surface-muted border border-border',
  ghost: 'bg-transparent text-muted hover:text-deep hover:bg-surface-alt',
  danger: 'bg-red-500 text-white hover:bg-red-600',
}

export function Button({
  children,
  variant = 'primary',
  icon,
  fullWidth = false,
  loading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={`
        inline-flex items-center justify-center gap-2
        px-6 py-3 rounded-button
        font-heading font-medium text-sm
        transition-shadow duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        cursor-pointer
        ${variantStyles[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon ? (
        <span className="w-4 h-4">{icon}</span>
      ) : null}
      {children}
    </motion.button>
  )
}