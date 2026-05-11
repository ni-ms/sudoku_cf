import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Grid } from '../components/Grid'
import { NumberPad } from '../components/NumberPad'
import { Timer } from '../components/Timer'
import { PlayerStrip } from '../components/PlayerStrip'
import { useRoomSocket } from '../hooks/useRoomSocket'
import { ensureGuest, getToken, getUser } from '../lib/auth'
import { useGameStore } from '../store/gameStore'
import { CELLS } from '../lib/sudoku'

// Play is just a gate: shows JoinGate when unauthenticated, PlayRoom otherwise.
// Session is kept in state so ensureGuest() can update it without navigation.
export function Play() {
  const { roomId } = useParams<{ roomId: string }>()
  const [session, setSession] = useState<{ token: string; userId: string } | null>(() => {
    const t = getToken()
    const u = getUser()
    return t && u ? { token: t, userId: u.id } : null
  })

  if (!session) {
    return <JoinGate roomId={roomId!} onJoined={setSession} />
  }

  return <PlayRoom roomId={roomId!} token={session.token} myId={session.userId} />
}

function JoinGate({
  roomId,
  onJoined,
}: {
  roomId: string
  onJoined: (s: { token: string; userId: string }) => void
}) {
  const [name, setName] = useState(() => getUser()?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Enter a nickname first.'); return }
    setBusy(true)
    setError(null)
    try {
      const { token, user } = await ensureGuest(trimmed)
      onJoined({ token, userId: user.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-4">
      <div className="card w-full flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          Join room{' '}
          <code className="rounded-lg bg-zinc-800 px-2 py-0.5 font-mono text-indigo-300">
            {roomId}
          </code>
        </h2>
        <input
          className="input"
          placeholder="Your nickname"
          value={name}
          maxLength={24}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleJoin() }}
        />
        <button onClick={() => void handleJoin()} disabled={busy} className="btn-primary">
          {busy ? '…' : 'Join'}
        </button>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>
    </div>
  )
}

function PlayRoom({ roomId, token, myId }: { roomId: string; token: string; myId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const winnerId = useGameStore((s) => s.winnerId)
  const results = useGameStore((s) => s.results)
  const players = useGameStore((s) => s.players)

  const { send } = useRoomSocket({
    roomId,
    token,
    myId,
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
      useGameStore.setState({
        roomId: null,
        players: [],
        cursors: {},
        progress: {},
        myId: null,
        winnerId: null,
        results: [],
        startedAt: null,
        finishedAt: null,
        errors: 0,
        selected: null,
        pencilMode: false,
        history: [],
        redoStack: [],
        givens: new Array<number>(CELLS).fill(0),
        cells: new Array(CELLS).fill(null).map(() => ({ value: 0, given: false, pencil: [], wrong: false })),
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