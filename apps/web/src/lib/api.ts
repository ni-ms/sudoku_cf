import type { Difficulty, Mode } from '@sudoku-cf/shared'
import { getToken } from './auth'
import { apiUrl } from './config'

async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('authorization', `Bearer ${token}`)
  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  return fetch(apiUrl(input), { ...init, headers })
}

export async function fetchRandomPuzzle(difficulty: Difficulty): Promise<{
  difficulty: Difficulty
  puzzle: number[]
}> {
  const res = await fetch(apiUrl(`/api/puzzles/random?difficulty=${difficulty}`))
  if (!res.ok) throw new Error('failed to load puzzle')
  return (await res.json()) as { difficulty: Difficulty; puzzle: number[] }
}

export async function createRoom(mode: Mode, difficulty: Difficulty): Promise<{
  roomId: string
  mode: Mode
  difficulty: Difficulty
}> {
  const res = await authFetch('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ mode, difficulty }),
  })
  if (!res.ok) throw new Error('failed to create room')
  return res.json() as Promise<{ roomId: string; mode: Mode; difficulty: Difficulty }>
}

export async function fetchLeaderboard(difficulty: Difficulty): Promise<LeaderboardEntry[]> {
  const res = await fetch(apiUrl(`/api/leaderboard?difficulty=${difficulty}`))
  if (!res.ok) throw new Error('failed to load leaderboard')
  const data = (await res.json()) as { entries: LeaderboardEntry[] }
  return data.entries
}

export interface LeaderboardEntry {
  room_id: string
  mode: string
  difficulty: string
  duration_ms: number
  finished_at: number
  user_id: string | null
  name: string | null
}