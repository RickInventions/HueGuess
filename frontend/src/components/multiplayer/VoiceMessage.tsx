import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'

/**
 * Playback for one voice note.
 *
 * Each bubble owns its own `Audio` element, but they coordinate through a
 * module-level reference to whichever is currently playing: starting one pauses
 * the other. Without that, tapping down a backlog of notes plays them all at
 * once, which is unintelligible.
 */

interface VoiceMessageProps {
  url: string
  durationMs: number
  /** Own messages sit on the primary tint, so the controls need more contrast. */
  isYou?: boolean
}

/** The element that is playing right now, across every mounted bubble. */
let nowPlaying: HTMLAudioElement | null = null

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `0:${String(total).padStart(2, '0')}`
}

export function VoiceMessage({ url, durationMs, isYou = false }: VoiceMessageProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [failed, setFailed] = useState(false)

  // Leaving a playing element behind on unmount keeps the audio going after the
  // panel is gone, with no way left to stop it.
  useEffect(() => {
    return () => {
      const audio = audioRef.current
      if (!audio) return
      audio.pause()
      if (nowPlaying === audio) nowPlaying = null
    }
  }, [])

  const toggle = () => {
    let audio = audioRef.current
    if (!audio) {
      audio = new Audio(url)
      // Deliberately no crossOrigin: nothing here decodes samples or draws a
      // waveform, so the element does not need a CORS-clean response. Asking for
      // one only added a way for playback to fail.
      audio.preload = 'metadata'
      audio.addEventListener('timeupdate', () => setPosition(audio!.currentTime * 1000))
      audio.addEventListener('ended', () => {
        setPlaying(false)
        setPosition(0)
        if (nowPlaying === audio) nowPlaying = null
      })
      // The only signal that actually means "this file will not play". Drop the
      // element with it, so the next tap builds a fresh one and genuinely retries
      // rather than re-failing on a poisoned instance.
      audio.addEventListener('error', () => {
        setFailed(true)
        setPlaying(false)
        if (nowPlaying === audio) nowPlaying = null
        if (audioRef.current === audio) audioRef.current = null
      })
      audioRef.current = audio
    }

    if (playing) {
      audio.pause()
      setPlaying(false)
      if (nowPlaying === audio) nowPlaying = null
      return
    }

    if (nowPlaying && nowPlaying !== audio) nowPlaying.pause()
    nowPlaying = audio
    setFailed(false)
    audio.play().then(
      () => setPlaying(true),
      // A rejected play() is nearly always the browser cancelling one call with
      // the next — a double tap, or a pause landing on top of it. Treating that
      // as a broken file left playable notes reading "Audio unavailable" for the
      // rest of the session; the 'error' listener above is what decides that.
      () => setPlaying(false)
    )
  }

  // Fall back to the server-recorded duration: a WebM produced by MediaRecorder
  // often has no duration in its header, so the element reports Infinity.
  const total = durationMs || 1
  const progress = Math.min(100, (position / total) * 100)

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : failed ? 'Retry voice message' : 'Play voice message'}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
          failed
            ? 'bg-surface-muted text-deep hover:bg-surface-alt'
            : isYou
              ? 'bg-primary text-white'
              : 'bg-primary/15 text-primary hover:bg-primary/25'
        } cursor-pointer`}
      >
        {failed ? (
          <RotateCcw className="h-3 w-3" />
        ) : playing ? (
          <Pause className="h-3 w-3" />
        ) : (
          <Play className="h-3 w-3" />
        )}
      </button>

      {failed ? (
        // Kept tappable rather than disabled: the usual cause is one bad fetch,
        // and a second attempt normally works.
        <span className="text-[10px] text-muted">Tap to retry</span>
      ) : (
        <>
          {/* A bar rather than a waveform: a real waveform means decoding the
              whole file up front, for a ten-second clip nobody scrubs. */}
          <span className="h-1 w-20 overflow-hidden rounded-full bg-primary/20 sm:w-28">
            <span
              className="block h-full rounded-full bg-primary transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted">
            {clock(playing || position > 0 ? total - position : total)}
          </span>
        </>
      )}
    </span>
  )
}
