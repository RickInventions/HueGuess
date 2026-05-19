// import { useState } from 'react'
// import { motion } from 'framer-motion'
// import { Clock, Eye, Play } from 'lucide-react'
// import { Button } from '../ui/Button'
// import type { MultiplayerConfig } from '../../types'

// interface RoomSetupProps {
//   onCreate: (config: MultiplayerConfig) => void
//   loading?: boolean
// }

// export function RoomSetup({ onCreate, loading }: RoomSetupProps) {
//   const [roundDuration, setRoundDuration] = useState(20)
//   const [colorDuration, setColorDuration] = useState(3)

//   return (
//     <motion.div
//       initial={{ opacity: 0, y: 20 }}
//       animate={{ opacity: 1, y: 0 }}
//       className="space-y-5"
//     >
//       <h3 className="font-heading text-xl font-semibold text-center">Create Room</h3>

//       {/* Round Duration */}
//       <div className="space-y-2">
//         <div className="flex items-center justify-between">
//           <div className="flex items-center gap-2 text-sm text-muted">
//             <Clock className="w-4 h-4" />
//             <span>Round Duration</span>
//           </div>
//           <span className="text-sm font-mono font-medium">{roundDuration}s</span>
//         </div>
//         <input
//         title="Round Duration"
//           type="range"
//           min={15}
//           max={30}
//           value={roundDuration}
//           onChange={(e) => setRoundDuration(Number(e.target.value))}
//           className="w-full accent-primary"
//         />
//         <div className="flex justify-between text-xs text-muted">
//           <span>15s</span>
//           <span>30s</span>
//         </div>
//       </div>

//       {/* Color Duration */}
//       <div className="space-y-2">
//         <div className="flex items-center justify-between">
//           <div className="flex items-center gap-2 text-sm text-muted">
//             <Eye className="w-4 h-4" />
//             <span>Color Visibility</span>
//           </div>
//           <span className="text-sm font-mono font-medium">{colorDuration}s</span>
//         </div>
//         <input
//         title="Color Visibility Duration"
//           type="range"
//           min={0.5}
//           max={7}
//           step={0.5}
//           value={colorDuration}
//           onChange={(e) => setColorDuration(Number(e.target.value))}
//           className="w-full accent-primary"
//         />
//         <div className="flex justify-between text-xs text-muted">
//           <span>0.5s</span>
//           <span>7s</span>
//         </div>
//       </div>

//       <Button
//         fullWidth
//         onClick={() => onCreate({ roundDuration, colorDuration })}
//         loading={loading}
//         icon={<Play className="w-4 h-4" />}
//       >
//         Create Room
//       </Button>
//     </motion.div>
//   )
// }