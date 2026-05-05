const TOKEN_KEY = 'sudoku-cf:token'
const USER_KEY = 'sudoku-cf:user'

export interface AuthUser {
  id: string
  name: string
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function saveSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function ensureGuest(name: string): Promise<{ token: string; user: AuthUser }> {
  const existing = getUser()
  const existingToken = getToken()
  if (existing && existingToken && existing.name === name) {
    return { token: existingToken, user: existing }
  }
  const res = await fetch('/api/auth/guest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('failed to authenticate')
  const data = (await res.json()) as { token: string; user: AuthUser }
  saveSession(data.token, data.user)
  return data
}