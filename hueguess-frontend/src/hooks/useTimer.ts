import { useState, useEffect, useCallback, useRef } from 'react'

interface UseTimerProps {
  duration: number // total seconds
  onExpire?: () => void
  autoStart?: boolean
}

export function useTimer({ duration, onExpire, autoStart = true }: UseTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration)
  const [isRunning, setIsRunning] = useState(autoStart)
  const [isExpired, setIsExpired] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(() => {
    setIsRunning(true)
    setIsExpired(false)
    setTimeLeft(duration)
  }, [duration])

  const stop = useCallback(() => {
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    stop()
    setTimeLeft(duration)
    setIsExpired(false)
  }, [duration, stop])

  useEffect(() => {
    if (!isRunning) return

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.1) {
          clearInterval(intervalRef.current!)
          setIsRunning(false)
          setIsExpired(true)
          onExpire?.()
          return 0
        }
        return prev - 0.1
      })
    }, 100)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, onExpire])

  const percentage = (timeLeft / duration) * 100

  return { timeLeft, isRunning, isExpired, percentage, start, stop, reset }
}