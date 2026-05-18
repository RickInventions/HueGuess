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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(0);
  const hasExpiredRef = useRef<boolean>(false);

  // Clear interval function
  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start timer
  const start = useCallback(() => {
    clearTimer();
    setIsActive(true);
    hasExpiredRef.current = false;
  }, [clearTimer]);

  // Pause timer
  const pause = useCallback(() => {
    clearTimer();
    setIsActive(false);
  }, [clearTimer]);

  // Reset timer
const reset = useCallback((newDuration?: number) => {
  const newTime = newDuration ?? duration
  clearTimer()

  setTimeRemaining(newTime)
  setIsActive(false)
  setIsUrgent(false)
  hasExpiredRef.current = false
  lastTickRef.current = 0
}, [duration, clearTimer])

  // Main timer effect
  useEffect(() => {
    if (!isActive) return;
    
    // Don't start if time is 0 or less
    if (timeRemaining <= 0) {
      if (!hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpire?.();
      }
      clearTimer();
      return;
    }
    
    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        
        // Call onTick callback
        onTick?.(newTime);
        
        // Check for urgency
        if (newTime <= isUrgentAt && newTime > 0) {
          setIsUrgent(true);
        }
        
        // Play tick sounds (only once per second)
        if (newTime <= 10 && newTime > 0 && lastTickRef.current !== newTime) {
          if (newTime <= 5) {
            soundService.playUrgentTick();
          } else {
            soundService.playTick();
          }
          lastTickRef.current = newTime;
        }
        
        // Check for expiration
        if (newTime <= 0) {
          clearTimer();
          setIsActive(false);
          if (!hasExpiredRef.current) {
            hasExpiredRef.current = true;
            onExpire?.();
          }
          return 0;
        }
        
        return newTime;
      });
    }, 1000);
    
    return clearTimer;
  }, [isActive, onExpire, onTick, isUrgentAt, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  // Update timeRemaining when duration changes
  useEffect(() => {
    if (!isActive) {
      setTimeRemaining(duration);
      setIsUrgent(false);
      lastTickRef.current = 0;
      hasExpiredRef.current = false;
    }
  }, [duration, isActive]);

  return {
    timeRemaining,
    isActive,
    isUrgent,
    start,
    pause,
    reset,
  };
}