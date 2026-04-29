import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TimerBarProps {
  duration: number;
  onComplete?: () => void;
  variant?: 'memorize' | 'submit';
  running?: boolean;
}

export function TimerBar({ duration, onComplete, variant = 'memorize', running = true }: TimerBarProps) {
  const [progress, setProgress] = useState(100);
  
  useEffect(() => {
    if (!running) return;
    
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = endTime - now;
      const pct = Math.max(0, (remaining / (duration * 1000)) * 100);
      
      setProgress(pct);
      
      if (pct <= 0) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 16);
    
    return () => clearInterval(interval);
  }, [duration, running, onComplete]);
  
  const isWarning = progress < 30;
  const isDanger = progress < 15;
  
  return (
    <div className="w-full h-1 bg-[#F1EEE7] rounded-full overflow-hidden">
      <motion.div
        className={cn(
          'h-full rounded-full',
          variant === 'memorize' && 'bg-primary',
          variant === 'submit' && !isWarning && 'bg-primary',
          variant === 'submit' && isWarning && !isDanger && 'bg-accent',
          variant === 'submit' && isDanger && 'bg-red-500',
        )}
        initial={{ width: '100%' }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.1, ease: 'linear' }}
      />
    </div>
  );
}