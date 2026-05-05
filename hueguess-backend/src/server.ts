import express from 'express'
import cors from 'cors'
import http from 'http'
import dotenv from 'dotenv'
import { initSocketServer } from './socket/index.js'
import authRoutes from './routes/auth.routes.js'
import gameRoutes from './routes/game.routes.js'
import statsRoutes from './routes/stats.routes.js'
import leaderboardRoutes from './routes/leaderboard.routes.js'
import adminRoutes from './routes/admin.routes.js'
import { rateLimiter, authRateLimiter, gameSubmitLimiter } from './middleware/rateLimiter.js'
import { sanitizeStrings, sanitizeColorInput } from './middleware/sanitizer.js'

dotenv.config()
// Strip console.log in production (keep console.error/warn)
if (process.env.NODE_ENV === 'production') {
  console.log = () => {}
  console.debug = () => {}
}
const app = express()
const PORT = process.env.PORT || 3000

// Create HTTP server
const httpServer = http.createServer(app)

// Initialize Socket.IO
initSocketServer(httpServer)

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '10kb' }))
app.use(sanitizeStrings)
app.use(rateLimiter(60000, 100))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// REST routes
app.use('/api/auth', authRateLimiter(), authRoutes)
app.use('/api/game/submit', gameSubmitLimiter(), sanitizeColorInput)
app.use('/api/game', gameRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/leaderboard', leaderboardRoutes)
app.use('/api/admin', adminRoutes)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message
  res.status(500).json({ error: message })
})

httpServer.listen(PORT, () => {
  console.log(`🎨 HueGuess API + WebSocket running on http://localhost:${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...')
  httpServer.close(() => process.exit(0))
})

export default app