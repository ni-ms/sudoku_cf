import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { formatDuration } from '../lib/sudoku'

export function Timer() {
  const startedAt = useGameStore((s) => s.startedAt)
  const finishedAt = useGameStore((s) => s.finishedAt)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (finishedAt) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [finishedAt])

  if (!startedAt) return <span className="font-mono text-zinc-400">--:--</span>
  const elapsed = (finishedAt ?? now) - startedAt
  return <span className="font-mono text-zinc-100 tabular-nums">{formatDuration(elapsed)}</span>
}