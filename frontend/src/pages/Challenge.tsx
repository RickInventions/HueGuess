// import { useState, useEffect } from 'react'
// import { useNavigate, useLocation } from 'react-router-dom'
// import { motion } from 'framer-motion'
// import { ArrowLeft, Copy, Check, LogOut, AlertTriangle } from 'lucide-react'
// import { useAuth } from '../context/AuthContext'
// import { useMultiplayer } from '../hooks/useMultiplayer'
// import { RoomSetup } from '../components/multiplayer/RoomSetup'
// import { JoinForm } from '../components/multiplayer/JoinForm'
// import { PlayerList } from '../components/multiplayer/PlayerList'
// import { Button } from '../components/ui/Button'
// import { Card } from '../components/ui/Card'
// import type { MultiplayerConfig } from '../types'

// type View = 'choose' | 'create' | 'join' | 'waiting'

// export default function Challenge() {
//   const navigate = useNavigate()
//   const location = useLocation()
//   const { user } = useAuth()
//   const mp = useMultiplayer()

//   const [view, setView] = useState<View>(() => {
//     if (mp.roomCode) return 'waiting'
//     return 'choose'
//   })
//   const [creating, setCreating] = useState(false)
//   const [joining, setJoining] = useState(false)
//   const [copied, setCopied] = useState(false)
//   const [error, setError] = useState<string | null>(
//     (location.state as any)?.message || null
//   )
//   const [navigated, setNavigated] = useState(false)

//   // Watch mp.roomCode — clear loading states when it appears
//   useEffect(() => {
//     if (mp.roomCode) {
//       setCreating(false)
//       setJoining(false)
//       setError(null)
//     }
//   }, [mp.roomCode])

//   // Watch mp.error — show it and stop loading
//   useEffect(() => {
//     if (mp.error) {
//       setError(mp.error)
//       setCreating(false)
//       setJoining(false)
//       // Auto-clear after 6 seconds
//       const timer = setTimeout(() => setError(null), 6000)
//       return () => clearTimeout(timer)
//     }
//   }, [mp.error])

//   // Navigate to /room when game starts
//   useEffect(() => {
//     if (mp.status === 'waiting' || mp.status === 'idle') {
//       setNavigated(false)
//     }
//     if ((mp.status === 'playing' || mp.status === 'round_ended' || mp.status === 'countdown') && !navigated) {
//       console.log('🧭 Navigating to /room — status:', mp.status)
//       setNavigated(true)
//       navigate('/room', { replace: true })
//     }
//   }, [mp.status, navigated, navigate])

//   // Sync view with room state
//   useEffect(() => {
//     if (mp.roomCode && view !== 'waiting') {
//       setView('waiting')
//     } else if (!mp.roomCode && view === 'waiting') {
//       setView('choose')
//       setNavigated(false)
//     }
//   }, [mp.roomCode, view])

//   if (!user) {
//     return (
//       <div className="max-w-game mx-auto px-4 py-12 text-center space-y-4">
//         <p className="text-muted">Please log in to play multiplayer.</p>
//         <Button onClick={() => navigate('/login')}>Log in</Button>
//       </div>
//     )
//   }

//   const handleCreate = (config: MultiplayerConfig) => {
//     setCreating(true)
//     setError(null)
//     mp.createRoom(config)
//     // Fallback: if no roomCode after 6 seconds, show error
//     setTimeout(() => {
//       setCreating(false)
//     }, 6000)
//   }

//   const handleJoin = (code: string) => {
//     setJoining(true)
//     setError(null)
//     mp.joinRoom(code)
//     // Fallback: if no roomCode after 6 seconds, show error
//     setTimeout(() => {
//       setJoining(false)
//     }, 6000)
//   }

//   const handleCopyCode = () => {
//     if (mp.roomCode) {
//       navigator.clipboard.writeText(mp.roomCode)
//       setCopied(true)
//       setTimeout(() => setCopied(false), 2000)
//     }
//   }

//   const handleLeave = () => {
//     mp.leaveRoom()
//     setView('choose')
//     setCreating(false)
//     setJoining(false)
//     setError(null)
//     setNavigated(false)
//   }

//   const currentPlayer = mp.players.find(p => p.username === user.username)
//   const isReady = currentPlayer?.isReady ?? false
//   const connectedPlayers = mp.players.filter(p => p.connected)
//   const allReady = connectedPlayers.length >= 2 && connectedPlayers.every(p => p.isReady)

//   return (
//     <div className="max-w-game mx-auto px-4 py-6 space-y-6">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <button
//           onClick={() => {
//             if (mp.roomCode) mp.leaveRoom()
//             navigate('/')
//           }}
//           className="flex items-center gap-1 text-muted hover:text-deep transition-colors"
//         >
//           <ArrowLeft className="w-4 h-4" />
//           <span className="text-sm">Back</span>
//         </button>
//         {mp.roomCode && (
//           <span className="text-xs font-medium text-muted">
//             {connectedPlayers.length}/4 players
//           </span>
//         )}
//       </div>

//       {/* Error banner */}
//       {error && (
//         <motion.div
//           initial={{ opacity: 0, y: -10 }}
//           animate={{ opacity: 1, y: 0 }}
//           className="flex items-center gap-2 p-4 rounded-xl bg-accent/10 border border-accent/20 text-sm text-accent"
//         >
//           <AlertTriangle className="w-4 h-4 shrink-0" />
//           <span>{error}</span>
//           <button
//             onClick={() => setError(null)}
//             className="ml-auto text-accent/60 hover:text-accent"
//           >
//             ✕
//           </button>
//         </motion.div>
//       )}

//       {/* Choose mode */}
//       {view === 'choose' && (
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           className="space-y-4"
//         >
//           <h2 className="font-heading text-section text-center">Challenge</h2>
//           <p className="text-center text-sm text-muted">Play with friends in real-time</p>
//           <Button fullWidth onClick={() => setView('create')}>
//             Create Room
//           </Button>
//           <Button fullWidth variant="secondary" onClick={() => setView('join')}>
//             Join Room
//           </Button>
//         </motion.div>
//       )}

//       {/* Create room form */}
//       {view === 'create' && (
//         <RoomSetup onCreate={handleCreate} loading={creating} />
//       )}

//       {/* Join room form */}
//       {view === 'join' && (
//         <JoinForm onJoin={handleJoin} loading={joining} />
//       )}

//       {/* Waiting room */}
//       {view === 'waiting' && mp.roomCode && (
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           className="space-y-6"
//         >
//           <Card className="text-center space-y-3">
//             <p className="text-xs text-muted uppercase tracking-wider">Room Code</p>
//             <div className="flex items-center justify-center gap-3">
//               <span className="font-heading text-2xl font-bold tracking-[0.15em]">
//                 {mp.roomCode}
//               </span>
//               <button
//                 onClick={handleCopyCode}
//                 className="p-2 rounded-button hover:bg-surface-alt transition-colors"
//               >
//                 {copied ? (
//                   <Check className="w-4 h-4 text-success" />
//                 ) : (
//                   <Copy className="w-4 h-4 text-muted" />
//                 )}
//               </button>
//             </div>
//             <p className="text-xs text-muted">
//               Share this code with friends to join
//             </p>
//           </Card>

//           {mp.config && (
//             <div className="flex justify-center gap-4 text-xs text-muted">
//               <span>🕐 {mp.config.roundDuration}s rounds</span>
//               <span>👁 {mp.config.colorDuration}s visibility</span>
//             </div>
//           )}

//           {/* Countdown overlay */}
//           {mp.status === 'countdown' && (
//             <motion.div
//               initial={{ scale: 0.5, opacity: 0 }}
//               animate={{ scale: 1, opacity: 1 }}
//               className="text-center py-4"
//             >
//               <span className="font-heading text-6xl font-bold text-primary">
//                 {mp.countdown}
//               </span>
//               <p className="text-muted mt-2">Game starting...</p>
//             </motion.div>
//           )}

//           <PlayerList
//             players={mp.players}
//             hostSocketId={mp.hostSocketId || ''}
//           />

//           {!allReady && connectedPlayers.length >= 2 && mp.status !== 'countdown' && (
//             <p className="text-center text-xs text-muted">
//               Waiting for all players to ready up...
//             </p>
//           )}
//           {connectedPlayers.length < 2 && (
//             <p className="text-center text-xs text-accent">
//               Need at least 2 players to start
//             </p>
//           )}

//           {mp.status !== 'countdown' && (
//             <div className="flex gap-3">
//               {isReady ? (
//                 <Button variant="secondary" fullWidth onClick={mp.setUnready}>
//                   Unready
//                 </Button>
//               ) : (
//                 <Button fullWidth onClick={mp.setReady}>
//                   Ready
//                 </Button>
//               )}
//               <Button
//                 variant="ghost"
//                 onClick={handleLeave}
//                 icon={<LogOut className="w-4 h-4" />}
//               >
//                 Leave
//               </Button>
//             </div>
//           )}
//         </motion.div>
//       )}
//     </div>
//   )
// }