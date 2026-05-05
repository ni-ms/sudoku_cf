import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { GuestAuthBody } from '@sudoku-cf/shared'
import type { Env } from '../env'
import { issueGuestToken } from '../lib/jwt'
import { newUserId } from '../lib/id'

export const authRoutes = new Hono<{ Bindings: Env }>().post(
  '/guest',
  zValidator('json', GuestAuthBody),
  async (c) => {
    const { name } = c.req.valid('json')
    const id = newUserId()
    await c.env.DB.prepare('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)')
      .bind(id, name, Date.now())
      .run()
    const token = await issueGuestToken(id, name, c.env.JWT_SECRET)
    return c.json({ token, user: { id, name } })
  },
)