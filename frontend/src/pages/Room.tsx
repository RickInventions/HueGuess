// import { useEffect, useState } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { motion, AnimatePresence } from 'framer-motion'
// import { Send, Clock, Eye } from 'lucide-react'
// import { useMultiplayer } from '../hooks/useMultiplayer'
// import { ColorSliders } from '../components/game/ColorSliders'
// import { RoundResults } from '../components/multiplayer/RoundResults'
// import { RoomLeaderboard } from '../components/multiplayer/RoomLeaderboard'
// import { Button } from '../components/ui/Button'
// import { useTimer } from '../hooks/useTimer'

// export default function Room() {
//   const navigate = useNavigate()
//   const mp = useMultiplayer()
//   const [phase, setPhase] = useState<'loading' | 'memorize' | 'reconstruct'>('loading')

//   useEffect(() => {
//     if (mp.status === 'playing') {
//       setPhase('memorize')
//     } else {
//       setPhase('loading')
//     }
//   }, [mp.status, mp.currentRound])

//   useEffect(() => {
//     if (mp.status === 'idle' && !mp.roomCode) {
//       if (mp.error) {
//         navigate('/challenge', { replace: true, state: { message: mp.error } })
//       } else {
//         navigate('/challenge', { replace: true })
//       }
//     }
//   }, [mp.status, mp.roomCode, mp.error, navigate])

//   const memTimer = useTimer({
//     duration: mp.colorDuration || 3,
//     autoStart: phase === 'memorize' && mp.status === 'playing',
//     onExpire: () => setPhase('reconstruct'),
//   })

//   const roundTimer = useTimer({
//     duration: mp.roundDuration || 20,
//     autoStart: phase === 'reconstruct' && mp.status === 'playing',
//   })

//   const showColor = phase === 'memorize' && mp.status === 'playing'
//   const connectedPlayers = mp.players.filter(p => p.connected)

//   // ─── Waiting / Countdown ───────────────
//   if (mp.status === 'waiting' || mp.status === 'countdown') {
//     return (
//       <div className="max-w-game mx-auto px-4 py-12 text-center space-y-6">
//         {mp.status === 'countdown' ? (
//           <motion.div
//             key="countdown"
//             initial={{ scale: 0.5, opacity: 0 }}
//             animate={{ scale: 1, opacity: 1 }}
//           >
//             <span className="font-heading text-8xl font-bold text-primary">
//               {mp.countdown || '...'}
//             </span>
//             <p className="text-muted mt-4">Game starting...</p>
//           </motion.div>
//         ) : (
//           <div className="space-y-3">
//             <p className="text-muted">Waiting for game to start...</p>
//             <p className="text-xs text-muted">
//               {connectedPlayers.length}/{connectedPlayers.length} players · Room {mp.roomCode}
//             </p>
//             {connectedPlayers.length < 2 && (
//               <p className="text-xs text-accent">Need at least 2 players</p>
//             )}
//           </div>
//         )}
//       </div>
//     )
//   }

//   // ─── Round Ended ───────────────────────
//   if (mp.status === 'round_ended') {
//     return (
//       <div className="max-w-game mx-auto px-4 py-6 space-y-6">
//         <RoundResults results={mp.roundResults} timedOut={mp.timedOut} />
//         <RoomLeaderboard entries={mp.leaderboard} rounds={mp.currentRound} />

//         <div className="space-y-3">
//           <Button fullWidth onClick={mp.playAgain}>
//             Play Again ({mp.playAgainVotes.length}/{connectedPlayers.length})
//           </Button>

//           {mp.isHost && (
//             <Button variant="secondary" fullWidth onClick={mp.endRoom}>
//               End Session (Open Room)
//             </Button>
//           )}

//           <Button
//             variant="ghost"
//             fullWidth
//             onClick={() => { mp.leaveRoom(); navigate('/challenge', { replace: true }) }}
//           >
//             Leave Room
//           </Button>
//         </div>
//       </div>
//     )
//   }

//   // ─── Playing ───────────────────────────
//   if (mp.status === 'playing') {
//     return (
//       <div className="max-w-game mx-auto px-4 py-6 space-y-6">
//         {/* Header — single inline timer, no TimerBar */}
//         <div className="flex items-center justify-between">
//           <span className="text-xs font-medium text-muted">
//             Round {mp.currentRound} of {mp.totalRounds}
//           </span>
//           <div className="flex items-center gap-3 text-xs">
//             {phase === 'memorize' ? (
//               <div className="flex items-center gap-1.5 bg-surface-alt px-3 py-1.5 rounded-full">
//                 <Eye className="w-3 h-3 text-primary" />
//                 <span className="font-mono font-medium text-primary">
//                   {Math.ceil(memTimer.timeLeft)}s
//                 </span>
//               </div>
//             ) : (
//               <>
//                 <span className="text-muted">
//                   {mp.submittedCount}/{mp.totalPlayers}
//                 </span>
//                 <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
//                   roundTimer.percentage < 25 ? 'bg-accent/10' : 'bg-surface-alt'
//                 }`}>
//                   <Clock className={`w-3 h-3 ${
//                     roundTimer.percentage < 25 ? 'text-accent' : 'text-muted'
//                   }`} />
//                   <span className={`font-mono font-medium ${
//                     roundTimer.percentage < 25 ? 'text-accent' : 'text-muted'
//                   }`}>
//                     {Math.ceil(roundTimer.timeLeft)}s
//                   </span>
//                 </div>
//               </>
//             )}
//           </div>
//         </div>

//         {/* Memorization phase */}
//         <AnimatePresence mode="wait">
//           {showColor && mp.roundColor && (
//             <motion.div
//               key="memorize"
//               initial={{ opacity: 0, scale: 0.95 }}
//               animate={{ opacity: 1, scale: 1 }}
//               exit={{ opacity: 0, filter: 'blur(8px)' }}
//               transition={{ duration: 0.4 }}
//               className="space-y-4"
//             >
//               <div
//                 className="w-full aspect-square max-w-[240px] mx-auto rounded-2xl shadow-card transition-colors"
//                 style={{
//                   backgroundColor: `hsl(${mp.roundColor.h}, ${mp.roundColor.s}%, ${mp.roundColor.l}%)`,
//                 }}
//               />
//               <p className="text-center text-sm text-muted">
//                 Memorize this color
//               </p>
//             </motion.div>
//           )}

//           {/* Reconstruction phase */}
//           {phase === 'reconstruct' && mp.status === 'playing' && (
//             <motion.div
//               key="reconstruct"
//               initial={{ opacity: 0, y: 10 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.3 }}
//               className="space-y-6"
//             >

//               <ColorSliders
//                 color={mp.myColor}
//                 onChange={mp.updateMyColor}
//                 disabled={mp.hasSubmitted}
//               />

//               <Button
//                 fullWidth
//                 onClick={mp.submitColor}
//                 disabled={mp.hasSubmitted}
//                 icon={<Send className="w-4 h-4" />}
//               >
//                 {mp.hasSubmitted ? 'Submitted ✓' : 'Submit Guess'}
//               </Button>
//             </motion.div>
//           )}
//         </AnimatePresence>
//       </div>
//     )
//   }

//   return (
//     <div className="max-w-game mx-auto px-4 py-12 text-center">
//       <p className="text-muted">Loading...</p>
//     </div>
//   )
// }