import type { MiddlewareHandler } from 'hono'
import type { Env, AuthVars } from '../env'
import { verifyToken } from '../lib/jwt'

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: AuthVars }> = async (
  c,
  next,
) => {
  const header = c.req.header('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return c.json({ error: 'unauthorized' }, 401)
  const claims = await verifyToken(token, c.env.JWT_SECRET)
  if (!claims) return c.json({ error: 'unauthorized' }, 401)
  c.set('userId', claims.sub)
  c.set('userName', claims.name)
  await next()
}