import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Difficulty } from '@sudoku-cf/shared'
import { fetchLeaderboard, type LeaderboardEntry } from '../lib/api'
import { formatDuration } from '../lib/sudoku'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert']

export function Leaderboard() {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchLeaderboard(difficulty)
      .then((rows) => {
        if (!cancelled) setEntries(rows)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [difficulty])

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <header className="flex items-center justify-between">
        <Link to="/" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← home
        </Link>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
      </header>

      <div className="flex items-center gap-2">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            className={`rounded-xl px-3 py-1.5 text-xs capitalize transition-colors ${
              difficulty === d ? 'bg-indigo-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-300">{error}</div>}

      {loading ? (
        <div className="grid place-items-center py-16 text-zinc-500">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="card text-center text-zinc-400">No finishes yet for this difficulty.</div>
      ) : (
        <ol className="card divide-y divide-zinc-800 p-0">
          {entries.map((e, i) => (
            <li key={e.room_id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="w-6 text-right font-mono text-zinc-500">{i + 1}.</span>
                <span className="font-medium">{e.name ?? 'anonymous'}</span>
              </div>
              <span className="font-mono tabular-nums text-zinc-300">
                {formatDuration(e.duration_ms)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}