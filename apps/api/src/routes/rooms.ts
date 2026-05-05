import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { CreateRoomBody } from '@sudoku-cf/shared'
import type { Env, AuthVars } from '../env'
import { newRoomCode } from '../lib/id'
import { requireAuth } from '../middleware/auth'

export const roomRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>()
  .post('/', requireAuth, zValidator('json', CreateRoomBody), async (c) => {
    const body = c.req.valid('json')
    const code = newRoomCode()
    const id = c.env.ROOM.idFromName(code)
    const stub = c.env.ROOM.get(id)
    const init = await stub.fetch(
      new Request('https://do/init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomId: code, mode: body.mode, difficulty: body.difficulty }),
      }),
    )
    if (!init.ok) {
      return c.json({ error: 'failed to init room' }, 500)
    }
    return c.json({ roomId: code, mode: body.mode, difficulty: body.difficulty })
  })
  .get('/:id', async (c) => {
    const code = c.req.param('id')
    const id = c.env.ROOM.idFromName(code)
    const stub = c.env.ROOM.get(id)
    const res = await stub.fetch(new Request('https://do/meta'))
    if (!res.ok) return c.json({ error: 'not found' }, 404)
    return new Response(res.body, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  .get('/:id/ws', (c) => {
    const upgrade = c.req.header('upgrade')
    if (upgrade?.toLowerCase() !== 'websocket') return c.text('expected websocket', 426)
    const code = c.req.param('id')
    const id = c.env.ROOM.idFromName(code)
    const stub = c.env.ROOM.get(id)
    return stub.fetch(c.req.raw)
  })