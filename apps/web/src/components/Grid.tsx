import { useEffect, useMemo } from 'react'
import { useGameStore } from '../store/gameStore'
import { CELLS, boxOf, colOf, findConflicts, highlightedPeers, rowOf, sameDigitCells } from '../lib/sudoku'

interface Props {
  onCellChange?: (cell: number) => void
  onPlace?: (cell: number, value: number) => void
}

export function Grid({ onCellChange, onPlace }: Props) {
  const cells = useGameStore((s) => s.cells)
  const selected = useGameStore((s) => s.selected)
  const selectCell = useGameStore((s) => s.selectCell)
  const setValue = useGameStore((s) => s.setValue)
  const togglePencil = useGameStore((s) => s.togglePencil)
  const clearCell = useGameStore((s) => s.clearCell)
  const pencilMode = useGameStore((s) => s.pencilMode)
  const undo = useGameStore((s) => s.undo)
  const redo = useGameStore((s) => s.redo)
  const cursors = useGameStore((s) => s.cursors)
  const players = useGameStore((s) => s.players)
  const myId = useGameStore((s) => s.myId)

  const board = useMemo(() => cells.map((c) => c.value), [cells])
  const conflicts = useMemo(() => findConflicts(board), [board])
  const peers = useMemo(
    () => (selected !== null ? highlightedPeers(selected) : new Set<number>()),
    [selected],
  )
  const sameDigit = useMemo(
    () => (selected !== null ? sameDigitCells(board, selected) : new Set<number>()),
    [board, selected],
  )

  const remoteCursors = useMemo(() => {
    const map = new Map<number, string[]>()
    for (const [playerId, cell] of Object.entries(cursors)) {
      if (playerId === myId) continue
      const list = map.get(cell) ?? []
      list.push(playerId)
      map.set(cell, list)
    }
    return map
  }, [cursors, myId])

  const playerColor = (id: string): string =>
    players.find((p) => p.id === id)?.color ?? '#3b82f6'

  // Keyboard input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selected === null) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key >= '1' && e.key <= '9') {
        const v = Number(e.key)
        const usePencil = pencilMode || e.shiftKey
        if (usePencil) {
          togglePencil(selected, v)
        } else {
          setValue(selected, v)
          onPlace?.(selected, v)
        }
        e.preventDefault()
        return
      }
      if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') {
        clearCell(selected)
        onPlace?.(selected, 0)
        e.preventDefault()
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'h') {
        const next = colOf(selected) > 0 ? selected - 1 : selected
        selectCell(next)
        onCellChange?.(next)
        e.preventDefault()
      }
      if (e.key === 'ArrowRight' || e.key === 'l') {
        const next = colOf(selected) < 8 ? selected + 1 : selected
        selectCell(next)
        onCellChange?.(next)
        e.preventDefault()
      }
      if (e.key === 'ArrowUp' || e.key === 'k') {
        const next = rowOf(selected) > 0 ? selected - 9 : selected
        selectCell(next)
        onCellChange?.(next)
        e.preventDefault()
      }
      if (e.key === 'ArrowDown' || e.key === 'j') {
        const next = rowOf(selected) < 8 ? selected + 9 : selected
        selectCell(next)
        onCellChange?.(next)
        e.preventDefault()
      }
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
        if (e.shiftKey) redo()
        else undo()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected, pencilMode, setValue, togglePencil, clearCell, selectCell, undo, redo, onCellChange, onPlace])

  return (
    <div className="aspect-square w-full max-w-[min(90vw,560px)] select-none rounded-2xl bg-zinc-900 p-2 shadow-2xl ring-1 ring-zinc-800">
      <div className="grid h-full w-full grid-cols-9 grid-rows-9 gap-px overflow-hidden rounded-xl bg-zinc-700">
        {Array.from({ length: CELLS }, (_, i) => {
          const cell = cells[i]!
          const r = rowOf(i)
          const c = colOf(i)
          const isSelected = selected === i
          const isPeer = peers.has(i)
          const isSameDigit = cell.value !== 0 && sameDigit.has(i)
          const isConflict = conflicts.has(i)
          const cursorPlayers = remoteCursors.get(i) ?? []

          const borderRight = (c + 1) % 3 === 0 && c !== 8 ? 'after:bg-zinc-500' : ''
          const borderBottom = (r + 1) % 3 === 0 && r !== 8 ? 'before:bg-zinc-500' : ''

          return (
            <button
              key={i}
              onClick={() => {
                selectCell(i)
                onCellChange?.(i)
              }}
              className={[
                'relative flex items-center justify-center bg-zinc-900 text-2xl font-medium transition-colors',
                'sm:text-3xl',
                cell.given ? 'text-zinc-100' : (cell.wrong || isConflict) ? 'text-rose-400' : 'text-indigo-300',
                cell.wrong && !isSelected ? 'bg-rose-500/10' : '',
                isSelected ? 'bg-indigo-500/40 ring-2 ring-inset ring-indigo-400 z-10 animate-pulse-subtle' : '',
                !isSelected && isSameDigit ? 'bg-indigo-500/20' : '',
                !isSelected && !isSameDigit && isPeer ? 'bg-white/5' : '',
                "after:absolute after:right-[-1px] after:top-0 after:h-full after:w-px",
                "before:absolute before:bottom-[-1px] before:left-0 before:h-px before:w-full",
                borderRight,
                borderBottom,
              ].join(' ')}
            >
              {cell.value !== 0 ? (
                cell.value
              ) : cell.pencil.length > 0 ? (
                <PencilGrid marks={cell.pencil} />
              ) : null}

              {cursorPlayers.map((pid, idx) => (
                <span
                  key={pid}
                  className="pointer-events-none absolute inset-0 rounded-sm ring-2"
                  style={{
                    boxShadow: `inset 0 0 0 ${2 + idx}px ${playerColor(pid)}`,
                  }}
                />
              ))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PencilGrid({ marks }: { marks: number[] }) {
  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 text-[10px] leading-none text-zinc-500 sm:text-xs">
      {Array.from({ length: 9 }, (_, i) => {
        const v = i + 1
        return (
          <span key={v} className="flex items-center justify-center">
            {marks.includes(v) ? v : ''}
          </span>
        )
      })}
    </div>
  )
}