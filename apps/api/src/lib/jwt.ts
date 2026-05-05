import { sign, verify } from 'hono/jwt'

export interface Claims {
  sub: string
  name: string
  iat: number
  exp: number
  [key: string]: unknown
}

const TTL_SECONDS = 60 * 60 * 24 * 7
const ALG = 'HS256' as const

export async function issueGuestToken(userId: string, name: string, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: Claims = { sub: userId, name, iat: now, exp: now + TTL_SECONDS }
  return sign(payload, secret, ALG)
}

export async function verifyToken(token: string, secret: string): Promise<Claims | null> {
  try {
    const claims = (await verify(token, secret, ALG)) as unknown as Claims
    if (!claims.sub || !claims.name) return null
    return claims
  } catch {
    return null
  }
}