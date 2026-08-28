import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Loader2, Trash2 } from 'lucide-react'

/**
 * Hold-to-record voice notes.
 *
 * Hold rather than tap-to-start/tap-to-stop: a recording that keeps going because
 * someone did not notice it started is the failure mode worth designing out, and
 * releasing your finger is an unambiguous end.
 *
 * The component renders nothing at all when recording is impossible — no
 * `getUserMedia` (which includes every page served over plain http, since it is
 * secure-context only) or no `MediaRecorder`. A disabled mic button would just be
 * a thing to tap that does nothing.
 */

interface VoiceRecorderProps {
  /** Resolves when the note has been sent. Rejections surface as an error state. */
  onRecorded: (blob: Blob, durationMs: number) => Promise<void>
  disabled?: boolean
}

/** Hard cap. The server rejects anything longer, so keep the two in step. */
const MAX_MS = 10_000

/** Below this a hold reads as a mis-tap, not a message. */
const MIN_MS = 400

/**
 * Containers in descending preference.
 *
 * Opus in WebM is the smallest by a wide margin; Safari produces neither and
 * needs mp4. Checked at call time rather than by sniffing the browser.
 */
const CANDIDATE_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const type of CANDIDATE_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  // An empty string is legal and means "let the browser choose", which is better
  // than refusing to record on a browser we did not anticipate.
  return ''
}

const supported =
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined'

export function VoiceRecorder({ onRecorded, disabled = false }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const tickRef = useRef<number | null>(null)
  const capRef = useRef<number | null>(null)
  /** Set when the hold was too short, so `onstop` discards instead of sending. */
  const discardRef = useRef(false)
  /** True between pointerdown and release. Guards the permission-prompt gap. */
  const holdingRef = useRef(false)

  const cleanup = useCallback(() => {
    if (tickRef.current !== null) window.clearInterval(tickRef.current)
    if (capRef.current !== null) window.clearTimeout(capRef.current)
    tickRef.current = null
    capRef.current = null
    // Releasing the tracks is what turns off the browser's recording indicator.
    // Leaving them open leaves a phone showing "microphone in use" indefinitely.
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    recorderRef.current = null
    setRecording(false)
    setElapsed(0)
  }, [])

  // A recorder still running when the panel unmounts (leaving the room, a phase
  // change swapping layouts) would hold the microphone for the rest of the session.
  useEffect(() => cleanup, [cleanup])

  const stop = useCallback((discard: boolean) => {
    holdingRef.current = false
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      cleanup()
      return
    }
    discardRef.current = discard
    recorder.stop()
  }, [cleanup])

  const start = useCallback(async () => {
    if (disabled || sending || recorderRef.current) return

    holdingRef.current = true
    setError(null)
    const mimeType = pickMimeType()
    if (mimeType === null) return

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      // Denied, dismissed, or no input device. All the same to us.
      holdingRef.current = false
      setError('Microphone unavailable')
      return
    }

    // The hold can end while the permission prompt is still up — most visibly the
    // very first time, when the prompt is modal. Without this the recorder would
    // start after the release and nothing would ever stop it.
    if (!holdingRef.current) {
      stream.getTracks().forEach(track => track.stop())
      return
    }

    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      // Speech at 24 kbps in Opus is clearly intelligible and puts a ten-second
      // note around 30 KB, comfortably inside the server's 300 KB ceiling.
      audioBitsPerSecond: 24_000,
    })

    chunksRef.current = []
    recorderRef.current = recorder
    streamRef.current = stream
    startedAtRef.current = Date.now()
    discardRef.current = false

    recorder.ondataavailable = event => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }

    recorder.onstop = () => {
      const durationMs = Date.now() - startedAtRef.current
      const chunks = chunksRef.current
      const discard = discardRef.current
      discardRef.current = false
      cleanup()

      if (discard || durationMs < MIN_MS || chunks.length === 0) return

      const blob = new Blob(chunks, { type: chunks[0]?.type || mimeType || 'audio/webm' })
      setSending(true)
      onRecorded(blob, Math.min(durationMs, MAX_MS))
        .catch(() => setError('Could not send'))
        .finally(() => setSending(false))
    }

    recorder.start()
    setRecording(true)
    setElapsed(0)

    tickRef.current = window.setInterval(() => {
      setElapsed(Date.now() - startedAtRef.current)
    }, 100)

    // Stop ourselves at the cap rather than letting the upload be rejected for
    // being too long — the recording is already lost by then.
    capRef.current = window.setTimeout(() => stop(false), MAX_MS)
  }, [cleanup, disabled, onRecorded, sending, stop])

  if (!supported) return null

  const remaining = Math.max(0, MAX_MS - elapsed)
  const secondsLeft = Math.ceil(remaining / 1000)

  return (
    <div className="flex items-center gap-2">
      {recording && (
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-accent">
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
            aria-hidden="true"
          />
          {secondsLeft}s
          <Trash2 className="h-3 w-3 text-muted" aria-hidden="true" />
          <span className="text-muted">slide off to cancel</span>
        </span>
      )}
      {error && !recording && <span className="text-[10px] text-accent">{error}</span>}

      <button
        type="button"
        // Pointer events cover mouse, touch and pen with one pair of handlers.
        // `onPointerLeave` is the cancel gesture: sliding off the button before
        // releasing throws the recording away.
        onPointerDown={start}
        onPointerUp={() => stop(false)}
        onPointerLeave={() => recording && stop(true)}
        onPointerCancel={() => stop(true)}
        // Long-press on a phone otherwise pops the text-selection menu over the
        // button mid-recording.
        onContextMenu={e => e.preventDefault()}
        disabled={disabled || sending}
        aria-label={recording ? 'Release to send voice message' : 'Hold to record a voice message'}
        title="Hold to record"
        // touch-none stops the hold from scrolling the chat panel under it.
        className={`shrink-0 touch-none select-none rounded-button px-3 py-2 transition-colors ${
          recording
            ? 'bg-accent text-white'
            : 'bg-surface-alt text-muted hover:bg-surface-muted hover:text-deep'
        } disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted cursor-pointer`}
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
    </div>
  )
}
