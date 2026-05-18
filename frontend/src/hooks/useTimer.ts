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

  // Store callbacks in refs so they never cause the interval effect to restart
  const onExpireRef = useRef(onExpire);
  const onTickRef = useRef(onTick);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);
  useEffect(() => { onTickRef.current = onTick; }, [onTick]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (timeRemaining <= 0) return;
    clearTimer();
    setIsActive(true);
    hasExpiredRef.current = false;
  }, [clearTimer, timeRemaining]);

  const pause = useCallback(() => {
    clearTimer();
    setIsActive(false);
  }, [clearTimer]);

  const reset = useCallback((newDuration?: number) => {
    const newTime = newDuration ?? duration;
    clearTimer();
    setTimeRemaining(newTime);
    setIsActive(false);
    setIsUrgent(false);
    hasExpiredRef.current = false;
    lastTickRef.current = 0;
  }, [duration, clearTimer]);

  // Main timer effect — intentionally excludes onExpire/onTick/timeRemaining from deps
  // to prevent the interval from being torn down and recreated on every slider interaction.
  // Callbacks are accessed via refs so they always call the latest version.
  useEffect(() => {
    if (!isActive) return;

    if (timeRemaining <= 0) {
      if (!hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current?.();
      }
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;

        onTickRef.current?.(newTime);

        if (newTime <= isUrgentAt && newTime > 0) {
          setIsUrgent(true);
        }

        if (newTime <= 10 && newTime > 0 && lastTickRef.current !== newTime) {
          if (newTime <= 5) {
            soundService.playUrgentTick();
          } else {
            soundService.playTick();
          }
          lastTickRef.current = newTime;
        }

        if (newTime <= 0) {
          clearTimer();
          setIsActive(false);
          if (!hasExpiredRef.current) {
            hasExpiredRef.current = true;
            onExpireRef.current?.();
          }
          return 0;
        }

        return newTime;
      });
    }, 1000);

    return clearTimer;
  }, [isActive, isUrgentAt, clearTimer]); // ✅ onExpire/onTick/timeRemaining intentionally omitted

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  // Update timeRemaining when duration changes (but only if not active)
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