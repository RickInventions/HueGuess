import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, SendHorizontal } from 'lucide-react'
import type { ChatMessage } from '../../types/multiplayer'
import { Card } from '../ui/Card'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSend: (message: string) => void
  /** False while offline or reconnecting — the composer locks rather than dropping messages. */
  canSend: boolean
  currentUserId?: string
  /** Shorter list on the in-game layout, where the board needs the room. */
  compact?: boolean
  /** Usernames composing a message right now, excluding you. */
  typingUsers?: string[]
  /** Announce composing state. Throttled by the context — safe to call per keystroke. */
  onTyping?: (isTyping: boolean) => void
  className?: string
}

const MAX_RENDERED = 50

/** How long after the last keystroke we consider someone to have stopped. */
const TYPING_IDLE_MS = 2_500

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
  className = '',
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

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
    onSend(text)
    setInput('')
    stopTyping()
  }

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
                  className={`max-w-[85%] px-2.5 py-1.5 rounded-2xl text-xs break-words ${
                    isYou
                      ? 'bg-primary/15 text-deep rounded-br-md'
                      : 'bg-surface-alt text-deep/90 rounded-bl-md'
                  }`}
                >
                  {msg.message}
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

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={handleChange}
          onBlur={stopTyping}
          placeholder={canSend ? 'Type a message…' : 'Reconnecting…'}
          maxLength={200}
          aria-label="Chat message"
          disabled={!canSend}
          className="flex-1 min-w-0 px-3 py-2 rounded-button bg-surface-alt border border-border text-sm focus:outline-none focus:shadow-glow-primary disabled:opacity-50"
        />
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
