import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Env, AuthVars } from './env'
import { authRoutes } from './routes/auth'
import { roomRoutes } from './routes/rooms'
import { puzzleRoutes } from './routes/puzzles'
import { leaderboardRoutes } from './routes/leaderboard'

export { RoomDO } from './do/RoomDO'

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>()

app.use('*', logger())
app.use('/api/*', (c, next) =>
  cors({
    origin: c.env.ALLOWED_ORIGIN,
    credentials: true,
    allowHeaders: ['Authorization', 'Content-Type'],
  })(c, next),
)

app.get('/api/health', (c) => c.json({ ok: true }))

const api = app
  .basePath('/api')
  .route('/auth', authRoutes)
  .route('/rooms', roomRoutes)
  .route('/puzzles', puzzleRoutes)
  .route('/leaderboard', leaderboardRoutes)

export type AppType = typeof api

export default app