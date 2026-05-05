import { useState, useEffect, useCallback, useRef } from 'react'

interface UseTimerProps {
  duration: number
  onExpire?: () => void
  autoStart?: boolean
}

export function useTimer({ duration, onExpire, autoStart = true }: UseTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration)
  const [isRunning, setIsRunning] = useState(autoStart)
  const [isExpired, setIsExpired] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onExpireRef = useRef(onExpire)

  // Keep onExpire ref updated
  onExpireRef.current = onExpire

  const start = useCallback(() => {
    setTimeLeft(duration)
    setIsRunning(true)
    setIsExpired(false)
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

  // Reset when duration changes
  useEffect(() => {
    setTimeLeft(duration)
    setIsExpired(false)
  }, [duration])

  useEffect(() => {
    if (!isRunning) return

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.1) {
          clearInterval(intervalRef.current!)
          setIsRunning(false)
          setIsExpired(true)
          // 🔥 Call onExpire
          onExpireRef.current?.()
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
  }, [isRunning])

  // Restart when autoStart changes to true
  useEffect(() => {
    if (autoStart) {
      start()
    } else {
      stop()
    }
  }, [autoStart]) // eslint-disable-line

  const percentage = duration > 0 ? (timeLeft / duration) * 100 : 0

  return { timeLeft, isRunning, isExpired, percentage, start, stop, reset }
}