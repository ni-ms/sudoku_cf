import { create } from 'zustand'
import type { Player, PublicRoomState } from '@sudoku-cf/shared'
import { CELLS } from '../lib/sudoku'

export interface CellState {
  value: number
  given: boolean
  pencil: number[]
}

interface UndoEntry {
  cell: number
  prev: number
  prevPencil: number[]
}

interface GameState {
  givens: number[]
  cells: CellState[]
  selected: number | null
  pencilMode: boolean
  errors: number
  startedAt: number | null
  finishedAt: number | null
  history: UndoEntry[]
  redoStack: UndoEntry[]
  // multiplayer
  roomId: string | null
  players: Player[]
  cursors: Record<string, number>
  progress: Record<string, number>
  myId: string | null
  winnerId: string | null
  results: { playerId: string; name: string; durationMs: number | null; errors: number }[]
  // actions
  loadPuzzle: (puzzle: number[]) => void
  loadFromState: (state: PublicRoomState, myId: string) => void
  selectCell: (cell: number | null) => void
  togglePencilMode: () => void
  setValue: (cell: number, value: number) => void
  togglePencil: (cell: number, value: number) => void
  clearCell: (cell: number) => void
  undo: () => void
  redo: () => void
  applyRemoteCursor: (playerId: string, cell: number) => void
  applyPlayerJoin: (player: Player) => void
  applyPlayerLeave: (playerId: string) => void
  applyProgress: (playerId: string, filled: number) => void
  setStarted: (ts: number) => void
  setComplete: (winnerId: string, results: { playerId: string; name: string; durationMs: number | null; errors: number }[]) => void
  rollback: (cell: number) => void
  bumpError: () => void
}

function initCells(puzzle: number[]): CellState[] {
  return puzzle.map((v) => ({ value: v, given: v !== 0, pencil: [] }))
}

export const useGameStore = create<GameState>((set, get) => ({
  givens: new Array<number>(CELLS).fill(0),
  cells: initCells(new Array<number>(CELLS).fill(0)),
  selected: null,
  pencilMode: false,
  errors: 0,
  startedAt: null,
  finishedAt: null,
  history: [],
  redoStack: [],
  roomId: null,
  players: [],
  cursors: {},
  progress: {},
  myId: null,
  winnerId: null,
  results: [],

  loadPuzzle: (puzzle) =>
    set({
      givens: puzzle.slice(),
      cells: initCells(puzzle),
      selected: null,
      errors: 0,
      startedAt: Date.now(),
      finishedAt: null,
      history: [],
      redoStack: [],
      winnerId: null,
      results: [],
    }),

  loadFromState: (s, myId) => {
    const board = s.yourBoard ?? s.puzzle
    const pencil = s.yourPencil ?? Array.from({ length: CELLS }, () => [])
    const cells: CellState[] = board.map((v, i) => ({
      value: v,
      given: (s.puzzle[i] ?? 0) !== 0,
      pencil: pencil[i] ?? [],
    }))
    set({
      givens: s.puzzle.slice(),
      cells,
      roomId: s.roomId,
      players: s.players,
      cursors: s.cursors,
      myId,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      winnerId: s.winnerId,
      selected: null,
      history: [],
      redoStack: [],
    })
  },

  selectCell: (cell) => set({ selected: cell }),

  togglePencilMode: () => set((s) => ({ pencilMode: !s.pencilMode })),

  setValue: (cell, value) => {
    const { cells } = get()
    const c = cells[cell]
    if (!c || c.given) return
    const entry: UndoEntry = { cell, prev: c.value, prevPencil: c.pencil.slice() }
    const next = cells.slice()
    next[cell] = { ...c, value, pencil: [] }
    set((s) => ({ cells: next, history: [...s.history, entry], redoStack: [] }))
  },

  togglePencil: (cell, value) => {
    const { cells } = get()
    const c = cells[cell]
    if (!c || c.given || c.value !== 0) return
    const entry: UndoEntry = { cell, prev: c.value, prevPencil: c.pencil.slice() }
    const next = cells.slice()
    const idx = c.pencil.indexOf(value)
    const pencil =
      idx === -1 ? [...c.pencil, value].sort((a, b) => a - b) : c.pencil.filter((v) => v !== value)
    next[cell] = { ...c, pencil }
    set((s) => ({ cells: next, history: [...s.history, entry], redoStack: [] }))
  },

  clearCell: (cell) => {
    const { cells } = get()
    const c = cells[cell]
    if (!c || c.given) return
    const entry: UndoEntry = { cell, prev: c.value, prevPencil: c.pencil.slice() }
    const next = cells.slice()
    next[cell] = { ...c, value: 0, pencil: [] }
    set((s) => ({ cells: next, history: [...s.history, entry], redoStack: [] }))
  },

  undo: () => {
    const { history, cells } = get()
    if (history.length === 0) return
    const last = history[history.length - 1]!
    const next = cells.slice()
    const c = next[last.cell]
    if (!c) return
    const redoEntry: UndoEntry = { cell: last.cell, prev: c.value, prevPencil: c.pencil.slice() }
    next[last.cell] = { ...c, value: last.prev, pencil: last.prevPencil.slice() }
    set((s) => ({
      cells: next,
      history: history.slice(0, -1),
      redoStack: [...s.redoStack, redoEntry],
    }))
  },

  redo: () => {
    const { redoStack, cells } = get()
    if (redoStack.length === 0) return
    const last = redoStack[redoStack.length - 1]!
    const next = cells.slice()
    const c = next[last.cell]
    if (!c) return
    const histEntry: UndoEntry = { cell: last.cell, prev: c.value, prevPencil: c.pencil.slice() }
    next[last.cell] = { ...c, value: last.prev, pencil: last.prevPencil.slice() }
    set((s) => ({
      cells: next,
      redoStack: redoStack.slice(0, -1),
      history: [...s.history, histEntry],
    }))
  },

  applyRemoteCursor: (playerId, cell) =>
    set((s) => ({ cursors: { ...s.cursors, [playerId]: cell } })),

  applyPlayerJoin: (player) =>
    set((s) =>
      s.players.find((p) => p.id === player.id)
        ? s
        : { players: [...s.players, player] },
    ),

  applyPlayerLeave: (playerId) =>
    set((s) => {
      const cursors = { ...s.cursors }
      delete cursors[playerId]
      return { players: s.players.filter((p) => p.id !== playerId), cursors }
    }),

  applyProgress: (playerId, filled) =>
    set((s) => ({ progress: { ...s.progress, [playerId]: filled } })),

  setStarted: (ts) => set({ startedAt: ts }),

  setComplete: (winnerId, results) =>
    set({ winnerId, results, finishedAt: Date.now() }),

  rollback: (cell) =>
    set((s) => {
      const c = s.cells[cell]
      if (!c) return s
      const next = s.cells.slice()
      next[cell] = { ...c, value: 0 }
      return { cells: next, errors: s.errors + 1 }
    }),

  bumpError: () => set((s) => ({ errors: s.errors + 1 })),
}))