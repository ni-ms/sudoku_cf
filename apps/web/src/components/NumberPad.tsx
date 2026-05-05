import { useGameStore } from '../store/gameStore'

interface Props {
  onPlace: (cell: number, value: number) => void
}

export function NumberPad({ onPlace }: Props) {
  const selected = useGameStore((s) => s.selected)
  const setValue = useGameStore((s) => s.setValue)
  const togglePencil = useGameStore((s) => s.togglePencil)
  const clearCell = useGameStore((s) => s.clearCell)
  const pencilMode = useGameStore((s) => s.pencilMode)
  const togglePencilMode = useGameStore((s) => s.togglePencilMode)
  const undo = useGameStore((s) => s.undo)
  const redo = useGameStore((s) => s.redo)

  const press = (v: number) => {
    if (selected === null) return
    if (pencilMode) {
      togglePencil(selected, v)
    } else {
      setValue(selected, v)
      onPlace(selected, v)
    }
  }

  const erase = () => {
    if (selected === null) return
    clearCell(selected)
    onPlace(selected, 0)
  }

  return (
    <div className="flex w-full max-w-[min(90vw,560px)] flex-col gap-2">
      <div className="grid grid-cols-9 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => (
          <button
            key={v}
            onClick={() => press(v)}
            className="rounded-xl bg-zinc-800 py-3 text-lg font-semibold hover:bg-zinc-700"
          >
            {v}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={togglePencilMode}
          className={`rounded-xl py-2 text-sm font-medium transition-colors ${
            pencilMode ? 'bg-indigo-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700'
          }`}
        >
          {pencilMode ? 'Pencil ✓' : 'Pencil'}
        </button>
        <button onClick={erase} className="btn-ghost">
          Erase
        </button>
        <button onClick={undo} className="btn-ghost">
          Undo
        </button>
        <button onClick={redo} className="btn-ghost">
          Redo
        </button>
      </div>
    </div>
  )
}