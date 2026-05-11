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
// CORS is only relevant when accessed cross-origin (e.g. local dev via vite proxy).
// In prod everything is same-origin via Workers Assets. credentials: true is
// incompatible with origin: "*", so we omit it — auth uses Bearer tokens, not cookies.
app.use('/api/*', (c, next) =>
  cors({
    origin: c.env.ALLOWED_ORIGIN ?? '*',
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

// SPA fallback: serve index.html for non-API paths (React Router client-side nav).
// Returning 404 JSON for unknown /api/* paths avoids the confusing
// "Unexpected token '<'" error that occurs when HTML is parsed as JSON.
app.get('*', (c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'not found' }, 404)
  }
  const indexUrl = new URL('/index.html', c.req.url).href
  return c.env.ASSETS.fetch(new Request(indexUrl))
})

export default app