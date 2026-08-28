import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  Clock,
  Loader2,
  Search,
  Send,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useFriends } from '../../context/FriendsContext'
import { friends as friendsApi } from '../../lib/api'
import { Modal } from '../ui/Modal'
import { RankBadge as RankPill } from '../ui/RankBadge'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import type { FriendSearchResult } from '../../types/friends'

type Tab = 'friends' | 'requests' | 'search'

interface FriendsModalProps {
  open: boolean
  onClose: () => void
  /** True while the viewer is in a room, which is what enables Invite. */
  inRoom?: boolean
  /** Opens straight onto a tab — the add-friend icon in a player card uses 'search'. */
  initialTab?: Tab
}

/** Rank chip shared by every row, so a friend reads the same everywhere. */
function RankBadge({ rankTier, rating }: { rankTier: string | null; rating: number | null }) {
  if (!rankTier && rating === null) return null
  return (
    <span className="inline-flex items-center gap-1.5">
      <RankPill label={rankTier} size="xs" />
      {rating !== null && <span className="font-mono text-[11px] text-muted">{rating}</span>}
    </span>
  )
}

function Row({
  username,
  rankTier,
  rating,
  isOnline,
  note,
  actions,
}: {
  username: string
  rankTier: string | null
  rating: number | null
  isOnline?: boolean
  note?: string
  actions: React.ReactNode
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-card border border-border bg-surface-alt/60 px-3 py-2.5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {isOnline !== undefined && (
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${isOnline ? 'bg-success' : 'bg-muted/30'}`}
              title={isOnline ? 'Online' : 'Offline'}
              aria-label={isOnline ? 'Online' : 'Offline'}
            />
          )}
          <span className="truncate text-sm font-medium text-deep">{username}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <RankBadge rankTier={rankTier} rating={rating} />
          {note && <span className="text-[11px] text-muted">{note}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
    </motion.li>
  )
}

/** Small square icon button — the row actions are tight on a phone. */
function IconAction({
  onClick,
  label,
  children,
  tone = 'neutral',
  disabled,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
  tone?: 'neutral' | 'primary' | 'danger' | 'success'
  disabled?: boolean
}) {
  const tones = {
    neutral: 'text-muted hover:bg-surface-muted hover:text-deep',
    primary: 'text-primary hover:bg-primary/10',
    danger: 'text-red-500 hover:bg-red-500/10',
    success: 'text-success hover:bg-success/10',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-button p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

function EmptyState({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-muted">
      <span className="opacity-60">{icon}</span>
      <p className="text-xs">{children}</p>
    </div>
  )
}

export function FriendsModal({ open, onClose, inRoom = false, initialTab = 'friends' }: FriendsModalProps) {
  const {
    friends,
    incoming,
    outgoing,
    isLoading,
    refresh,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    removeFriend,
    inviteToRoom,
    invitedUserIds,
  } = useFriends()

  const [tab, setTab] = useState<Tab>(initialTab)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FriendSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<{ userId: string; username: string } | null>(null)

  // Opening the modal is the moment the list matters, so re-read then rather than
  // polling in the background.
  useEffect(() => {
    if (!open) return
    setTab(initialTab)
    void refresh()
  }, [open, initialTab, refresh])

  // While it stays open, keep re-reading: the online dots are a snapshot, and a
  // friend who comes online should become invitable without closing the modal.
  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => void refresh(), 20_000)
    return () => window.clearInterval(timer)
  }, [open, refresh])

  useEffect(() => {
    if (open) return
    // Clear the search when closed so it doesn't reopen onto stale results.
    setQuery('')
    setResults([])
    setSearchError(null)
  }, [open])

  // Debounced search. The ref lets a late response from an abandoned query be
  // discarded instead of overwriting the results of the current one.
  const queryRef = useRef(query)
  queryRef.current = query

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setSearching(false)
      setSearchError(null)
      return
    }

    setSearching(true)
    const timer = window.setTimeout(() => {
      friendsApi
        .search(term)
        .then(({ data }) => {
          if (queryRef.current.trim() !== term) return
          setResults(data.results ?? [])
          setSearchError(null)
        })
        .catch(() => {
          if (queryRef.current.trim() !== term) return
          setResults([])
          setSearchError('Search failed — try again')
        })
        .finally(() => {
          if (queryRef.current.trim() === term) setSearching(false)
        })
    }, 300)

    return () => window.clearTimeout(timer)
  }, [query])

  /** Re-run the current search so a row's button reflects the action just taken. */
  const rerunSearch = useCallback(async () => {
    const term = queryRef.current.trim()
    if (term.length < 2) return
    try {
      const { data } = await friendsApi.search(term)
      if (queryRef.current.trim() === term) setResults(data.results ?? [])
    } catch {
      /* the list is already on screen; leave it as it is */
    }
  }, [])

  const tabs = useMemo(
    () => [
      { key: 'friends' as Tab, label: 'Friends', count: friends.length },
      { key: 'requests' as Tab, label: 'Requests', count: incoming.length + outgoing.length },
      { key: 'search' as Tab, label: 'Add', count: 0 },
    ],
    [friends.length, incoming.length, outgoing.length]
  )

  const onlineFriends = useMemo(() => friends.filter(f => f.isOnline).length, [friends])

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Friends"
        subtitle={
          friends.length > 0
            ? `${onlineFriends} of ${friends.length} online`
            : 'Add friends to invite them straight into a room'
        }
        size="md"
      >
        <div
          role="tablist"
          aria-label="Friends sections"
          className="mb-4 flex gap-1 rounded-button bg-surface-alt p-1"
        >
          {tabs.map(item => (
            <button
              key={item.key}
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`flex-1 rounded-button px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                tab === item.key ? 'bg-surface text-deep shadow-card' : 'text-muted hover:text-deep'
              }`}
            >
              {item.label}
              {item.count > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-mono ${
                    tab === item.key ? 'bg-primary/15 text-primary' : 'bg-muted/15 text-muted'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Friends ─────────────────────────────────────────────────────── */}
        {tab === 'friends' && (
          <>
            {isLoading && friends.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : friends.length === 0 ? (
              <EmptyState icon={<Users className="h-7 w-7" />}>
                No friends yet. Use the Add tab to find someone by username.
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {friends.map(friend => {
                  const invited = invitedUserIds.includes(friend.userId)
                  return (
                    <Row
                      key={friend.userId}
                      username={friend.username}
                      rankTier={friend.rankTier}
                      rating={friend.rating}
                      isOnline={friend.isOnline}
                      note={!friend.isOnline ? 'Offline' : undefined}
                      actions={
                        <>
                          {inRoom && (
                            <IconAction
                              label={
                                invited
                                  ? 'Invite sent'
                                  : friend.isOnline
                                    ? `Invite ${friend.username} to this room`
                                    : `${friend.username} is offline`
                              }
                              tone={invited ? 'success' : 'primary'}
                              disabled={!friend.isOnline || invited}
                              onClick={() => inviteToRoom(friend.userId)}
                            >
                              {invited ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                            </IconAction>
                          )}
                          <IconAction
                            label={`Remove ${friend.username}`}
                            tone="danger"
                            onClick={() =>
                              setPendingRemoval({ userId: friend.userId, username: friend.username })
                            }
                          >
                            <UserMinus className="h-4 w-4" />
                          </IconAction>
                        </>
                      }
                    />
                  )
                })}
              </ul>
            )}

            {inRoom && friends.length > 0 && (
              <p className="mt-3 text-center text-[11px] text-muted">
                Invites reach friends who are online right now.
              </p>
            )}
          </>
        )}

        {/* ── Requests ────────────────────────────────────────────────────── */}
        {tab === 'requests' && (
          <>
            {incoming.length === 0 && outgoing.length === 0 ? (
              <EmptyState icon={<Clock className="h-7 w-7" />}>No pending requests.</EmptyState>
            ) : (
              <div className="space-y-5">
                {incoming.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                      Waiting on you
                    </h3>
                    <ul className="space-y-2">
                      {incoming.map(request => (
                        <Row
                          key={request.userId}
                          username={request.username}
                          rankTier={request.rankTier}
                          rating={request.rating}
                          actions={
                            <>
                              <IconAction
                                label={`Accept ${request.username}`}
                                tone="success"
                                onClick={() => void acceptRequest(request.userId)}
                              >
                                <Check className="h-4 w-4" />
                              </IconAction>
                              <IconAction
                                label={`Decline ${request.username}`}
                                tone="danger"
                                onClick={() => void declineRequest(request.userId)}
                              >
                                <X className="h-4 w-4" />
                              </IconAction>
                            </>
                          }
                        />
                      ))}
                    </ul>
                  </section>
                )}

                {outgoing.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                      Sent
                    </h3>
                    <ul className="space-y-2">
                      {outgoing.map(request => (
                        <Row
                          key={request.userId}
                          username={request.username}
                          rankTier={request.rankTier}
                          rating={request.rating}
                          note="Pending"
                          actions={
                            <IconAction
                              label={`Cancel request to ${request.username}`}
                              onClick={() => void cancelRequest(request.userId)}
                            >
                              <X className="h-4 w-4" />
                            </IconAction>
                          }
                        />
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Search ──────────────────────────────────────────────────────── */}
        {tab === 'search' && (
          <>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search by username"
                autoComplete="off"
                // 16px minimum: anything smaller makes iOS Safari zoom the page on focus.
                className="w-full rounded-button border border-border bg-surface-alt py-2.5 pl-9 pr-9 text-base sm:text-sm text-deep placeholder:text-muted focus:border-primary/40 focus:outline-none"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
              )}
            </div>

            {searchError && <p className="mb-3 text-center text-xs text-accent">{searchError}</p>}

            {query.trim().length < 2 ? (
              <EmptyState icon={<UserPlus className="h-7 w-7" />}>
                Type at least 2 characters to find someone.
              </EmptyState>
            ) : results.length === 0 && !searching ? (
              <EmptyState icon={<Search className="h-7 w-7" />}>
                No players matched “{query.trim()}”.
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {results.map(result => (
                  <Row
                    key={result.userId}
                    username={result.username}
                    rankTier={result.rankTier}
                    rating={result.rating}
                    isOnline={result.isOnline}
                    note={
                      result.relationship === 'friends'
                        ? 'Friend'
                        : result.relationship === 'request_sent'
                          ? 'Request sent'
                          : result.relationship === 'request_received'
                            ? 'Wants to be friends'
                            : undefined
                    }
                    actions={
                      result.relationship === 'friends' ? (
                        <Check className="h-4 w-4 text-success" aria-label="Already friends" />
                      ) : result.relationship === 'request_sent' ? (
                        <IconAction
                          label={`Cancel request to ${result.username}`}
                          onClick={() => void cancelRequest(result.userId).then(rerunSearch)}
                        >
                          <X className="h-4 w-4" />
                        </IconAction>
                      ) : result.relationship === 'request_received' ? (
                        <IconAction
                          label={`Accept ${result.username}`}
                          tone="success"
                          onClick={() => void acceptRequest(result.userId).then(rerunSearch)}
                        >
                          <Check className="h-4 w-4" />
                        </IconAction>
                      ) : (
                        <IconAction
                          label={`Add ${result.username}`}
                          tone="primary"
                          onClick={() =>
                            void sendRequest(result.userId, result.username).then(rerunSearch)
                          }
                        >
                          <UserPlus className="h-4 w-4" />
                        </IconAction>
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!pendingRemoval}
        onClose={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval) void removeFriend(pendingRemoval.userId)
        }}
        title="Remove friend?"
        message={
          pendingRemoval
            ? `${pendingRemoval.username} will be removed from your friends list. You can send a new request later.`
            : ''
        }
        confirmLabel="Remove"
        destructive
      />
    </>
  )
}

/**
 * Icon button that opens the modal, badged with the number of requests waiting
 * on you. Owns its own open state so every entry point is one line.
 */
export function FriendsLauncher({
  inRoom = false,
  className = '',
}: {
  inRoom?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const { pendingCount } = useFriends()

  const label =
    pendingCount > 0
      ? `Friends — ${pendingCount} pending ${pendingCount === 1 ? 'request' : 'requests'}`
      : 'Friends'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className={`relative rounded-button p-2 text-muted transition-colors hover:bg-primary/10 hover:text-primary cursor-pointer ${className}`}
      >
        <UserPlus className="h-4 w-4" />
        {pendingCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full bg-accent px-1 text-center font-mono text-[10px] leading-4 text-white">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
      </button>

      <FriendsModal open={open} onClose={() => setOpen(false)} inRoom={inRoom} />
    </>
  )
}
