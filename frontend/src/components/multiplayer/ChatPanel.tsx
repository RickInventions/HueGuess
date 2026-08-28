import { useCallback, useEffect, useRef, useState } from 'react'
import { CornerUpLeft, MessageCircle, SendHorizontal, X } from 'lucide-react'
import type { ChatMessage, ChatReplyTo, GamePhase } from '../../types/multiplayer'
import { voice as voiceApi } from '../../lib/api'
import { Card } from '../ui/Card'
import { VoiceMessage } from './VoiceMessage'
import { VoiceRecorder } from './VoiceRecorder'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSend: (message: string, replyTo?: ChatReplyTo) => void
  /** False while offline or reconnecting — the composer locks rather than dropping messages. */
  canSend: boolean
  currentUserId?: string
  /** Shorter list on the in-game layout, where the board needs the room. */
  compact?: boolean
  /** Usernames composing a message right now, excluding you. */
  typingUsers?: string[]
  /** Announce composing state. Throttled by the context — safe to call per keystroke. */
  onTyping?: (isTyping: boolean) => void
  /** Room code, needed to address a voice upload. Omitting it hides the mic. */
  roomCode?: string
  /** Voice is lobby-and-results only; the server enforces the same rule. */
  phase?: GamePhase
  className?: string
}

const MAX_RENDERED = 50

/** How long after the last keystroke we consider someone to have stopped. */
const TYPING_IDLE_MS = 2_500

/**
 * Phases where a voice note is allowed.
 *
 * Mid-round audio is a coaching channel — one player narrating the colour they
 * just saw while another is still reconstructing it. The server rejects uploads
 * outside these phases too; hiding the button is the courtesy, not the control.
 */
const VOICE_PHASES: GamePhase[] = ['waiting', 'results', 'ended']

function timeLabel(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** "Ana is typing…" / "Ana and Bo are typing…" / "3 people are typing…" */
function typingLabel(names: string[]): string {
  if (names.length === 1) return `${names[0]} is typing…`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
  return `${names.length} people are typing…`
}

export function ChatPanel({
  messages,
  onSend,
  canSend,
  currentUserId,
  compact = false,
  typingUsers = [],
  onTyping,
  roomCode,
  phase,
  className = '',
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [replyTo, setReplyTo] = useState<ChatReplyTo | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  /** Quote a message and put the cursor in the field, so replying is one tap. */
  const startReply = useCallback((msg: ChatMessage) => {
    setReplyTo({ username: msg.username, message: msg.message })
    inputRef.current?.focus()
  }, [])

  // Pin to the newest message. Scrolls the container itself rather than calling
  // scrollIntoView, which would drag the whole page on mobile. Runs on mount too,
  // so switching phases never leaves the panel parked at the top.
  //
  // Keyed on the array identity, not its length: the context caps the history at
  // 100, so past that point every new message leaves the length unchanged and a
  // length-keyed effect would quietly stop following the conversation.
  //
  // The indicator sits inside the scroller, so its appearance has to re-pin too.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, compact, typingUsers.length])

  // ── Outgoing typing signal ────────────────────────────────────────────────
  // A timer rather than a blur/keyup pair: someone who types a few words and then
  // sits still has stopped, even with the field still focused.
  const idleTimer = useRef<number | null>(null)
  const onTypingRef = useRef(onTyping)
  onTypingRef.current = onTyping

  const stopTyping = useCallback(() => {
    if (idleTimer.current !== null) {
      window.clearTimeout(idleTimer.current)
      idleTimer.current = null
    }
    onTypingRef.current?.(false)
  }, [])

  // Unmounting mid-sentence (leaving the room, a phase change swapping layouts)
  // would otherwise leave the indicator up for the rest of its TTL.
  useEffect(() => {
    return () => {
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current)
    }
  }, [])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value)
    if (!canSend || !onTypingRef.current) return

    if (event.target.value.trim().length === 0) {
      stopTyping()
      return
    }

    onTypingRef.current(true)
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(stopTyping, TYPING_IDLE_MS)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || !canSend) return
    onSend(text, replyTo ?? undefined)
    setInput('')
    setReplyTo(null)
    stopTyping()
  }

  // Nothing is added to the list here: the upload route broadcasts the message
  // itself, so it arrives back over the socket like any other. That keeps one
  // source of truth for chat history instead of an optimistic copy that has to be
  // reconciled with the real one.
  const sendVoice = useCallback(
    async (blob: Blob, durationMs: number) => {
      if (!roomCode) return
      await voiceApi.send(blob, roomCode, durationMs)
    },
    [roomCode]
  )

  const canRecord = !!roomCode && !!phase && VOICE_PHASES.includes(phase)

  const visible = messages.slice(-MAX_RENDERED)

  return (
    <Card className={`p-3 sm:p-4 flex flex-col ${className}`}>
      <h3 className="font-heading font-semibold text-sm flex items-center gap-2 mb-2.5">
        <MessageCircle className="w-4 h-4 text-primary" />
        Chat
        {messages.length > 0 && (
          <span className="ml-auto text-[10px] font-mono text-muted">{messages.length}</span>
        )}
      </h3>

      <div
        ref={scrollRef}
        className={`${
          compact ? 'h-32 sm:h-40 lg:h-44' : 'h-40 sm:h-52 lg:h-56'
        } overflow-y-auto overscroll-contain space-y-1.5 mb-2.5 pr-1`}
        aria-live="polite"
      >
        {visible.length === 0 ? (
          <p className="text-xs text-muted py-2">No messages yet — say hello.</p>
        ) : (
          visible.map((msg, i) => {
            const isYou = !!currentUserId && msg.userId === currentUserId
            // Collapse the name on a run of messages from the same person.
            const prev = i > 0 ? visible[i - 1] : undefined
            const showName = !prev || prev.userId !== msg.userId || prev.username !== msg.username

            return (
              <div
                key={`${msg.timestamp}-${i}`}
                className={`flex flex-col ${isYou ? 'items-end' : 'items-start'}`}
              >
                {showName && (
                  <span
                    className={`text-[10px] font-medium mb-0.5 px-1 ${
                      isYou ? 'text-primary' : 'text-muted'
                    }`}
                  >
                    {isYou ? 'You' : msg.username}
                    <span className="ml-1.5 font-mono text-muted">{timeLabel(msg.timestamp)}</span>
                  </span>
                )}
                <span
                  className={`group/msg flex max-w-full items-start gap-1 ${
                    isYou ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <span
                    className={`flex max-w-[85%] flex-col gap-1 px-2.5 py-1.5 rounded-2xl text-xs break-words ${
                      isYou
                        ? 'bg-primary/15 text-deep rounded-br-md'
                        : 'bg-surface-alt text-deep/90 rounded-bl-md'
                    }`}
                  >
                    {/* The quote is carried on the message itself, so it still renders
                        after the message it answers has aged out of the history. */}
                    {msg.replyTo && (
                      <span className="flex flex-col border-l-2 border-primary/40 pl-2 text-[10px]">
                        <span className="font-medium text-primary">{msg.replyTo.username}</span>
                        <span className="line-clamp-2 text-muted">{msg.replyTo.message}</span>
                      </span>
                    )}
                    {msg.voice ? (
                      <VoiceMessage
                        url={msg.voice.url}
                        durationMs={msg.voice.durationMs}
                        isYou={isYou}
                      />
                    ) : (
                      <span>{msg.message}</span>
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() => startReply(msg)}
                    aria-label={`Reply to ${isYou ? 'your message' : msg.username}`}
                    title="Reply"
                    // In the flow rather than absolutely placed: the list scrolls
                    // vertically, and an offset button hanging outside the bubble
                    // would give it something to scroll sideways too. Visible at 60%
                    // so it is tappable on a phone, where there is no hover.
                    className="mt-0.5 shrink-0 rounded-button p-1.5 text-muted opacity-60 transition-opacity hover:bg-surface-muted hover:text-deep group-hover/msg:opacity-100 cursor-pointer"
                  >
                    <CornerUpLeft className="h-3 w-3" />
                  </button>
                </span>
              </div>
            )
          })
        )}

        {/* Inside the scroller so it sits directly under the last message and
            scrolls with it, rather than pushing the composer around. */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-1.5 pt-0.5 pl-1">
            <span className="flex gap-1" aria-hidden="true">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-muted/50 animate-bounce"
                  style={{ animationDelay: `${i * 140}ms`, animationDuration: '1s' }}
                />
              ))}
            </span>
            <span className="text-[10px] text-muted italic truncate">{typingLabel(typingUsers)}</span>
          </div>
        )}
      </div>

      {/* Sits above the composer so it is impossible to send a reply without
          seeing what it is aimed at — the quote is fixed at tap time, and a
          message that scrolls away would otherwise leave no trace of it. */}
      {replyTo && (
        <div className="mb-2 flex items-start gap-2 rounded-button border-l-2 border-primary bg-surface-alt px-2.5 py-1.5">
          <span className="min-w-0 flex-1 flex flex-col">
            <span className="text-[10px] font-medium text-primary">
              Replying to {replyTo.username}
            </span>
            <span className="truncate text-xs text-muted">{replyTo.message}</span>
          </span>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            aria-label="Cancel reply"
            className="shrink-0 rounded-button p-1 text-muted transition-colors hover:bg-surface-muted hover:text-deep cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleChange}
          onBlur={stopTyping}
          placeholder={canSend ? 'Type a message…' : 'Reconnecting…'}
          maxLength={200}
          aria-label="Chat message"
          disabled={!canSend}
          // text-base below sm stops iOS Safari zooming the page on focus, which
          // it does to any field under 16px.
          className="flex-1 min-w-0 px-3 py-2 rounded-button bg-surface-alt border border-border sm:text-sm focus:outline-none focus:shadow-glow-primary disabled:opacity-50"
        />
        {canRecord && <VoiceRecorder onRecorded={sendVoice} disabled={!canSend} />}
        <button
          type="submit"
          disabled={!canSend || !input.trim()}
          aria-label="Send message"
          className="shrink-0 px-3 rounded-button bg-primary text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <SendHorizontal className="w-4 h-4" />
        </button>
      </form>
    </Card>
  )
}
