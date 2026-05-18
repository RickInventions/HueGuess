import { useState, useEffect, useCallback, useRef } from 'react';
import { soundService } from '../services/soundService';

interface UseTimerOptions {
  duration: number;
  onExpire?: () => void;
  onTick?: (timeRemaining: number) => void;
  autoStart?: boolean;
  isUrgentAt?: number;
}

export function useTimer({ duration, onExpire, onTick, autoStart = true, isUrgentAt = 5 }: UseTimerOptions) {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isActive, setIsActive] = useState(autoStart);
  const [isUrgent, setIsUrgent] = useState(false);
  const lastTickRef = useRef<number>(0);

  const reset = useCallback((newDuration?: number) => {
    const newTime = newDuration ?? duration;
    setTimeRemaining(newTime);
    setIsActive(true);
    setIsUrgent(false);
    lastTickRef.current = 0;
  }, [duration]);

  const pause = useCallback(() => {
    setIsActive(false);
  }, []);

  const resume = useCallback(() => {
    setIsActive(true);
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsActive(false);
          onExpire?.();
          return 0;
        }
        
        const newTime = prev - 1;
        
        // Check for urgency
        if (newTime <= isUrgentAt && newTime > 0 && !isUrgent) {
          setIsUrgent(true);
        }
        
        // Play tick sounds
        if (newTime <= 10 && newTime > 0 && lastTickRef.current !== newTime) {
          if (newTime <= 5) {
            soundService.playUrgentTick();
          } else {
            soundService.playTick();
          }
          lastTickRef.current = newTime;
        }
        
        onTick?.(newTime);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, duration, onExpire, onTick, isUrgentAt, isUrgent]);

  // Reset when duration changes
  useEffect(() => {
    setTimeRemaining(duration);
    setIsUrgent(false);
    lastTickRef.current = 0;
  }, [duration]);

  return {
    timeRemaining,
    isActive,
    isUrgent,
    reset,
    pause,
    resume,
  };
}