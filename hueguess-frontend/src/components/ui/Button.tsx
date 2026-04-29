import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className,
  ...props
}: ButtonProps) {

  const baseClasses =
    'inline-flex items-center justify-center font-heading font-semibold rounded-pill transition-all duration-200 cursor-pointer';

  const variants = {
    primary: 'text-white',
    secondary: 'bg-surface-muted text-text-deep hover:bg-surface-soft',
    ghost: 'bg-transparent text-text-muted hover:text-text-deep',
  };

  const sizes = {
    sm: 'px-6 py-2 text-sm',
    md: 'px-8 py-3 text-base',
    lg: 'px-10 py-4 text-lg',
  };

  return (
    <motion.button
      className={cn(
        baseClasses,
        variants[variant],
        sizes[size],
        className
      )}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      style={
        variant === 'primary'
          ? {
              background:
                'linear-gradient(135deg, #5E60FF, #7D7EFF)',
            }
          : undefined
      }
      {...props}
    >
      {children}
    </motion.button>
  );
}