import { useEffect, useRef, useState } from 'react'
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
  className?: string
}

const MAX_RENDERED = 50

function timeLabel(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function ChatPanel({
  messages,
  onSend,
  canSend,
  currentUserId,
  compact = false,
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
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, compact])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || !canSend) return
    onSend(text)
    setInput('')
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
                    <span className="ml-1.5 font-mono text-muted/60">{timeLabel(msg.timestamp)}</span>
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
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
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
