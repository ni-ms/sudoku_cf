import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ensureGuest, getUser } from '../lib/auth'
import { createRoom } from '../lib/api'
import type { Difficulty, Mode } from '@sudoku-cf/shared'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert']

export function Home() {
  const [name, setName] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [mode] = useState<Mode>('race')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    const u = getUser()
    if (u) setName(u.name)
  }, [])

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Pick a nickname first.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await ensureGuest(name.trim())
      const r = await createRoom(mode, difficulty)
      nav(`/play/${r.roomId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async () => {
    if (!name.trim() || !joinCode.trim()) {
      setError('Need a nickname and a room code.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await ensureGuest(name.trim())
      nav(`/play/${joinCode.trim().toUpperCase()}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-indigo-400">Sudoku</span> Multiplayer
        </h1>
        <Link to="/leaderboard" className="btn-ghost">
          Leaderboard
        </Link>
      </header>

      <section className="card flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Your nickname</h2>
        <input
          className="input"
          placeholder="e.g. zephyr"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
        />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Create a race room</h2>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`rounded-xl px-3 py-1.5 text-sm capitalize transition-colors ${
                  difficulty === d ? 'bg-indigo-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <button onClick={handleCreate} disabled={busy} className="btn-primary">
            {busy ? '...' : 'Create room'}
          </button>
          <Link to="/solo" className="text-sm text-zinc-400 hover:text-zinc-200">
            Or play solo →
          </Link>
        </section>

        <section className="card flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Join with code</h2>
          <input
            className="input uppercase tracking-wider"
            placeholder="ABCDEF"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={8}
          />
          <button onClick={handleJoin} disabled={busy} className="btn-primary">
            {busy ? '...' : 'Join'}
          </button>
        </section>
      </div>

      {error && <div className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-300">{error}</div>}
    </div>
  )
}