import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { friends as friendsApi } from '../lib/api'
import { soundService } from '../services/soundService'
import { useAuth } from './AuthContext'
import { useSocket } from './SocketContext'
import { useMultiplayer } from '../hooks/useMultiplayer'
import type {
  Friend,
  FriendRelationship,
  FriendRequest,
  RoomInvite,
} from '../types/friends'

/**
 * Friend list, pending requests, and room invites.
 *
 * Global rather than room-scoped: a request can arrive while you're on any page,
 * and the friends modal is reachable from the navbar as well as from a room.
 *
 * Mounted inside MultiplayerProvider because accepting an invite has to go
 * through the same join path as typing a code by hand.
 */

interface FriendsContextType {
  friends: Friend[]
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
  isLoading: boolean
  /** Unanswered incoming requests — drives the navbar badge. */
  pendingCount: number

  refresh: () => Promise<void>
  relationshipFor: (userId: string) => FriendRelationship
  sendRequest: (userId: string, username?: string) => Promise<void>
  acceptRequest: (userId: string) => Promise<void>
  declineRequest: (userId: string) => Promise<void>
  cancelRequest: (userId: string) => Promise<void>
  removeFriend: (userId: string) => Promise<void>
  /** Push a room invite over the socket. Only works while you're in a room. */
  inviteToRoom: (userId: string) => void
  /**
   * userIds you invited recently enough that the button is still on cooldown.
   * Entries expire on their own, so inviting twice needs no reload.
   */
  invitedUserIds: string[]
}

const FriendsContext = createContext<FriendsContextType | undefined>(undefined)

function errorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { error?: string } } })?.response
  return response?.data?.error || fallback
}

export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useSocket()
  const { user, isAuthenticated } = useAuth()
  const { currentRoom, joinRoom } = useMultiplayer()
  const navigate = useNavigate()

  const [friends, setFriends] = useState<Friend[]>([])
  const [incoming, setIncoming] = useState<FriendRequest[]>([])
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)

  /**
   * userId → epoch ms at which their Invite button comes back.
   *
   * A map with self-expiring entries rather than a growing list: the old list was
   * only ever cleared when the room changed, so within one room you could invite
   * someone exactly once per page load.
   */
  const [inviteCooldowns, setInviteCooldowns] = useState<Record<string, number>>({})
  const cooldownTimers = useRef<Map<string, number>>(new Map())

  /** Mark someone invited and schedule the entry's own removal. */
  const startInviteCooldown = useCallback((userId: string, durationMs: number) => {
    const running = cooldownTimers.current.get(userId)
    if (running) window.clearTimeout(running)

    setInviteCooldowns(prev => ({ ...prev, [userId]: Date.now() + durationMs }))

    // No ticking countdown label: that is a re-render a second for a button that
    // simply comes back. It reads "Invite sent" until this fires.
    const timer = window.setTimeout(() => {
      cooldownTimers.current.delete(userId)
      setInviteCooldowns(prev => {
        if (!(userId in prev)) return prev
        const next = { ...prev }
        delete next[userId]
        return next
      })
    }, durationMs)

    cooldownTimers.current.set(userId, timer)
  }, [])

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setFriends([])
      setIncoming([])
      setOutgoing([])
      return
    }

    setIsLoading(true)
    try {
      const { data } = await friendsApi.list()
      setFriends(data.friends ?? [])
      setIncoming(data.incoming ?? [])
      setOutgoing(data.outgoing ?? [])
    } catch {
      // Silent: the list is supporting information, and a failed background
      // refresh should not throw a toast over whatever the user is doing.
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  // Load once signed in, and clear on sign-out so the next account starts clean.
  useEffect(() => {
    void refresh()
  }, [refresh])

  // A fresh socket means presence changed for everyone; re-read so the online
  // dots aren't stale from before the reconnect.
  useEffect(() => {
    if (!socket) return
    const onConnect = () => void refresh()
    socket.on('connect', onConnect)
    return () => {
      socket.off('connect', onConnect)
    }
  }, [socket, refresh])

  // Invites are not persisted, so this ref only guards against the same invite
  // being announced twice within one session (a duplicate emit, a quick re-send).
  const seenInvites = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!socket) return

    const onRequestReceived = (data: { userId: string; username: string }) => {
      soundService.playNotify()
      toast.info(`${data.username} sent you a friend request`)
      void refresh()
    }

    const onRequestAccepted = (data: { userId: string; username: string }) => {
      soundService.playNotify()
      toast.success(`${data.username} accepted your friend request`)
      void refresh()
    }

    const onFriendRemoved = () => {
      // Deliberately quiet — being un-friended is not something to announce.
      void refresh()
    }

    const onRoomInvite = (invite: RoomInvite) => {
      if (!invite?.code) return

      const key = `${invite.fromUserId}:${invite.code}`
      if (seenInvites.current.has(key)) return
      seenInvites.current.add(key)
      // Let the same invite land again after a while, in case they re-send.
      window.setTimeout(() => seenInvites.current.delete(key), 60_000)

      // Already in that exact room — nothing to accept.
      if (currentRoom?.code === invite.code) return

      soundService.playNotify()
      toast(`${invite.fromUsername} invited you to a room`, {
        description: invite.inProgress
          ? `Room ${invite.code} · game in progress`
          : `Room ${invite.code} · ${invite.playerCount}/${invite.maxPlayers} players · ${invite.difficulty}`,
        duration: 15_000,
        action: {
          label: 'Join',
          onClick: () => {
            joinRoom(invite.code)
              .then(() => navigate(`/room/${invite.code}`))
              .catch(error => toast.error(error?.message || 'Could not join that room'))
          },
        },
      })
    }

    const onInviteSent = (data: { userId: string; delivered: boolean; cooldownMs?: number }) => {
      if (data.delivered) {
        startInviteCooldown(data.userId, data.cooldownMs ?? 60_000)
      } else {
        toast.error('They went offline — invite not delivered')
      }
    }

    socket.on('friend_request_received', onRequestReceived)
    socket.on('friend_request_accepted', onRequestAccepted)
    socket.on('friend_removed', onFriendRemoved)
    socket.on('room_invite', onRoomInvite)
    socket.on('invite_sent', onInviteSent)

    return () => {
      socket.off('friend_request_received', onRequestReceived)
      socket.off('friend_request_accepted', onRequestAccepted)
      socket.off('friend_removed', onFriendRemoved)
      socket.off('room_invite', onRoomInvite)
      socket.off('invite_sent', onInviteSent)
    }
  }, [socket, refresh, currentRoom?.code, joinRoom, navigate, startInviteCooldown])

  // Invites are scoped to a room, so leaving one drops every cooldown with it.
  useEffect(() => {
    for (const timer of cooldownTimers.current.values()) window.clearTimeout(timer)
    cooldownTimers.current.clear()
    setInviteCooldowns({})
  }, [currentRoom?.code])

  // Nothing should still be ticking after the provider goes away.
  useEffect(() => {
    const timers = cooldownTimers.current
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer)
      timers.clear()
    }
  }, [])

  const invitedUserIds = useMemo(() => Object.keys(inviteCooldowns), [inviteCooldowns])

  const relationshipFor = useCallback(
    (userId: string): FriendRelationship => {
      if (!userId) return 'none'
      if (user?.id === userId) return 'self'
      if (friends.some(f => f.userId === userId)) return 'friends'
      if (incoming.some(r => r.userId === userId)) return 'request_received'
      if (outgoing.some(r => r.userId === userId)) return 'request_sent'
      return 'none'
    },
    [friends, incoming, outgoing, user?.id]
  )

  const sendRequest = useCallback(
    async (userId: string, username?: string) => {
      try {
        const { data } = await friendsApi.request(userId)
        // The server accepts instead of duplicating when they had already asked us.
        if (data.status === 'accepted') {
          toast.success(username ? `You and ${username} are now friends` : 'You are now friends')
        } else {
          toast.success(username ? `Request sent to ${username}` : 'Friend request sent')
        }
        await refresh()
      } catch (error) {
        toast.error(errorMessage(error, 'Could not send that request'))
      }
    },
    [refresh]
  )

  const acceptRequest = useCallback(
    async (userId: string) => {
      try {
        await friendsApi.accept(userId)
        await refresh()
      } catch (error) {
        toast.error(errorMessage(error, 'Could not accept that request'))
      }
    },
    [refresh]
  )

  const declineRequest = useCallback(
    async (userId: string) => {
      try {
        await friendsApi.decline(userId)
        await refresh()
      } catch (error) {
        toast.error(errorMessage(error, 'Could not decline that request'))
      }
    },
    [refresh]
  )

  const cancelRequest = useCallback(
    async (userId: string) => {
      try {
        await friendsApi.cancel(userId)
        await refresh()
      } catch (error) {
        toast.error(errorMessage(error, 'Could not cancel that request'))
      }
    },
    [refresh]
  )

  const removeFriend = useCallback(
    async (userId: string) => {
      try {
        await friendsApi.remove(userId)
        await refresh()
      } catch (error) {
        toast.error(errorMessage(error, 'Could not remove that friend'))
      }
    },
    [refresh]
  )

  const inviteToRoom = useCallback(
    (userId: string) => {
      if (!socket?.connected) {
        toast.error('Not connected — invite not sent')
        return
      }
      if (!currentRoom) {
        toast.error('Join a room first, then invite friends to it')
        return
      }
      socket.emit('invite_to_room', { userId })
    },
    [socket, currentRoom]
  )

  const value = useMemo(
    () => ({
      friends,
      incoming,
      outgoing,
      isLoading,
      pendingCount: incoming.length,
      refresh,
      relationshipFor,
      sendRequest,
      acceptRequest,
      declineRequest,
      cancelRequest,
      removeFriend,
      inviteToRoom,
      invitedUserIds,
    }),
    [
      friends,
      incoming,
      outgoing,
      isLoading,
      refresh,
      relationshipFor,
      sendRequest,
      acceptRequest,
      declineRequest,
      cancelRequest,
      removeFriend,
      inviteToRoom,
      invitedUserIds,
    ]
  )

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>
}

export function useFriends() {
  const context = useContext(FriendsContext)
  if (context === undefined) {
    throw new Error('useFriends must be used within a FriendsProvider')
  }
  return context
}
