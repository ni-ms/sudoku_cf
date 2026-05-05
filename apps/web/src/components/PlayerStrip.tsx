import { useGameStore } from '../store/gameStore'
import { CELLS } from '../lib/sudoku'

export function PlayerStrip() {
  const players = useGameStore((s) => s.players)
  const progress = useGameStore((s) => s.progress)
  const givens = useGameStore((s) => s.givens)
  const myId = useGameStore((s) => s.myId)
  const cells = useGameStore((s) => s.cells)

  const givenCount = givens.filter((g) => g !== 0).length
  const totalToFill = CELLS - givenCount
  const myFilled = cells.filter((c) => c.value !== 0 && !c.given).length

  return (
    <div className="flex flex-wrap gap-3">
      {players.map((p) => {
        const isMe = p.id === myId
        const filled = isMe ? myFilled + givenCount : (progress[p.id] ?? givenCount)
        const pct = Math.round(((filled - givenCount) / Math.max(totalToFill, 1)) * 100)
        return (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2"
          >
            <div
              className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: p.color }}
            >
              {p.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {p.name} {isMe && <span className="text-xs text-zinc-400">(you)</span>}
              </span>
              <div className="h-1 w-24 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full"
                  style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: p.color }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}