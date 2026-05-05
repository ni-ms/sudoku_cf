import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { Difficulty } from '@sudoku-cf/shared'
import type { Env } from '../env'

const Query = z.object({
  difficulty: Difficulty.default('medium'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const leaderboardRoutes = new Hono<{ Bindings: Env }>().get(
  '/',
  zValidator('query', Query),
  async (c) => {
    const { difficulty, limit } = c.req.valid('query')
    const rs = await c.env.DB.prepare(
      `SELECT g.room_id, g.mode, g.difficulty, g.duration_ms, g.finished_at,
              gp.user_id, gp.name
         FROM games g
    LEFT JOIN game_players gp
           ON gp.room_id = g.room_id AND gp.user_id = g.winner_id
        WHERE g.difficulty = ?
        ORDER BY g.duration_ms ASC
        LIMIT ?`,
    )
      .bind(difficulty, limit)
      .all()
    return c.json({ entries: rs.results ?? [] })
  },
)