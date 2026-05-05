import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Grid } from '../components/Grid'
import { NumberPad } from '../components/NumberPad'
import { Timer } from '../components/Timer'
import { PlayerStrip } from '../components/PlayerStrip'
import { useRoomSocket } from '../hooks/useRoomSocket'
import { getToken, getUser } from '../lib/auth'
import { useGameStore } from '../store/gameStore'

export function Play() {
  const { roomId } = useParams<{ roomId: string }>()
  const token = getToken()
  const user = getUser()
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const winnerId = useGameStore((s) => s.winnerId)
  const results = useGameStore((s) => s.results)
  const players = useGameStore((s) => s.players)

  if (!token || !user || !roomId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-zinc-300">You need to set a nickname first.</p>
        <Link to="/" className="mt-4 inline-block text-indigo-400 hover:underline">
          Go back home →
        </Link>
      </div>
    )
  }

  const { send } = useRoomSocket({
    roomId,
    token,
    myId: user.id,
    onConnected: () => setConnected(true),
    onError: (m) => setError(m),
  })

  const handleCellChange = (cell: number) => {
    send({ t: 'cursor', cell })
  }

  const handlePlace = (cell: number, value: number) => {
    send({ t: 'place', cell, value })
  }

  const winner = useMemo(
    () => (winnerId ? players.find((p) => p.id === winnerId) ?? null : null),
    [winnerId, players],
  )

  useEffect(() => {
    return () => {
      // Reset store when leaving room so next game starts clean.
      useGameStore.setState({
        roomId: null,
        players: [],
        cursors: {},
        progress: {},
        myId: null,
        winnerId: null,
        results: [],
        finishedAt: null,
      })
    }
  }, [])

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← home
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-400">room</span>
          <code className="rounded-lg bg-zinc-800 px-2 py-0.5 font-mono">{roomId}</code>
          <button
            onClick={() => void navigator.clipboard.writeText(window.location.href)}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            copy link
          </button>
          <span className="text-zinc-600">•</span>
          <Timer />
        </div>
      </header>

      <PlayerStrip />

      {error && (
        <div className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-300">{error}</div>
      )}

      {!connected ? (
        <div className="grid place-items-center py-16 text-zinc-500">Connecting…</div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <Grid onCellChange={handleCellChange} onPlace={handlePlace} />
          <NumberPad onPlace={handlePlace} />
        </div>
      )}

      {winnerId && (
        <div className="rounded-2xl bg-emerald-500/10 px-4 py-4 text-emerald-200">
          <div className="text-lg font-semibold">
            {winner ? `${winner.name} wins!` : 'Game complete'}
          </div>
          {results.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {results
                .slice()
                .sort((a, b) => (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity))
                .map((r) => (
                  <li key={r.playerId} className="flex justify-between">
                    <span>{r.name}</span>
                    <span className="font-mono tabular-nums">
                      {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : 'dnf'} · {r.errors} errs
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}