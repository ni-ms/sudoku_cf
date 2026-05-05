import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Grid } from '../components/Grid'
import { NumberPad } from '../components/NumberPad'
import { Timer } from '../components/Timer'
import { useGameStore } from '../store/gameStore'
import { fetchRandomPuzzle } from '../lib/api'
import type { Difficulty } from '@sudoku-cf/shared'
import { isComplete } from '../lib/sudoku'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert']

export function Solo() {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cells = useGameStore((s) => s.cells)
  const errors = useGameStore((s) => s.errors)
  const finishedAt = useGameStore((s) => s.finishedAt)
  const loadPuzzle = useGameStore((s) => s.loadPuzzle)

  const newGame = async (d: Difficulty) => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetchRandomPuzzle(d)
      loadPuzzle(r.puzzle)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void newGame(difficulty)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Detect win locally (solo mode is purely client-side)
  useEffect(() => {
    if (finishedAt) return
    const board = cells.map((c) => c.value)
    if (isComplete(board)) {
      useGameStore.setState({ finishedAt: Date.now() })
    }
  }, [cells, finishedAt])

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <Link to="/" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← home
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-400">errors</span>
          <span className="font-mono tabular-nums">{errors}</span>
          <span className="text-zinc-600">•</span>
          <Timer />
        </div>
      </header>

      <div className="flex items-center gap-2">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            onClick={() => {
              setDifficulty(d)
              void newGame(d)
            }}
            className={`rounded-xl px-3 py-1.5 text-xs capitalize transition-colors ${
              difficulty === d ? 'bg-indigo-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            {d}
          </button>
        ))}
        <button onClick={() => void newGame(difficulty)} className="ml-auto btn-ghost text-xs">
          New puzzle
        </button>
      </div>

      {error && <div className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-300">{error}</div>}

      {loading ? (
        <div className="grid place-items-center py-16 text-zinc-500">Loading puzzle…</div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <Grid />
          <NumberPad onPlace={() => {}} />
        </div>
      )}

      {finishedAt && (
        <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-center text-emerald-300">
          Solved! Tap "New puzzle" for another.
        </div>
      )}
    </div>
  )
}