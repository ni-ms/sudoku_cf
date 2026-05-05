// Sudoku generator, solver, validator. All boards are flat number[81]; 0 = empty.

export const SIZE = 9
export const CELLS = 81

export function rowOf(i: number): number {
  return Math.floor(i / 9)
}
export function colOf(i: number): number {
  return i % 9
}
export function boxOf(i: number): number {
  return Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3)
}

const PEERS: number[][] = (() => {
  const peers: number[][] = []
  for (let i = 0; i < CELLS; i++) {
    const r = rowOf(i)
    const c = colOf(i)
    const b = boxOf(i)
    const set = new Set<number>()
    for (let j = 0; j < CELLS; j++) {
      if (j === i) continue
      if (rowOf(j) === r || colOf(j) === c || boxOf(j) === b) set.add(j)
    }
    peers.push([...set])
  }
  return peers
})()

export function peersOf(i: number): readonly number[] {
  return PEERS[i] ?? []
}

export function isValidPlacement(board: number[], cell: number, value: number): boolean {
  if (value === 0) return true
  for (const p of peersOf(cell)) {
    if (board[p] === value) return false
  }
  return true
}

export function isComplete(board: number[]): boolean {
  for (let i = 0; i < CELLS; i++) {
    const v = board[i]
    if (!v || v < 1 || v > 9) return false
  }
  for (let i = 0; i < CELLS; i++) {
    for (const p of peersOf(i)) {
      if (board[i] === board[p]) return false
    }
  }
  return true
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = a[i] as T
    a[i] = a[j] as T
    a[j] = tmp
  }
  return a
}

// Returns the number of solutions found (capped at `cap`).
export function countSolutions(board: number[], cap = 2): number {
  const work = board.slice()
  let found = 0

  function findEmpty(): number {
    let bestIdx = -1
    let bestCount = 10
    for (let i = 0; i < CELLS; i++) {
      if (work[i] === 0) {
        let c = 0
        const used = new Uint8Array(10)
        for (const p of peersOf(i)) {
          const v = work[p] as number
          if (v) used[v] = 1
        }
        for (let v = 1; v <= 9; v++) if (!used[v]) c++
        if (c < bestCount) {
          bestCount = c
          bestIdx = i
          if (c <= 1) return i
        }
      }
    }
    return bestIdx
  }

  function recurse(): boolean {
    const i = findEmpty()
    if (i === -1) {
      found++
      return found >= cap
    }
    const used = new Uint8Array(10)
    for (const p of peersOf(i)) {
      const v = work[p] as number
      if (v) used[v] = 1
    }
    for (let v = 1; v <= 9; v++) {
      if (used[v]) continue
      work[i] = v
      if (recurse()) return true
      work[i] = 0
    }
    return false
  }

  recurse()
  return found
}

export function solve(board: number[]): number[] | null {
  const work = board.slice()
  function findEmpty(): number {
    for (let i = 0; i < CELLS; i++) if (work[i] === 0) return i
    return -1
  }
  function recurse(): boolean {
    const i = findEmpty()
    if (i === -1) return true
    const used = new Uint8Array(10)
    for (const p of peersOf(i)) {
      const v = work[p] as number
      if (v) used[v] = 1
    }
    for (let v = 1; v <= 9; v++) {
      if (used[v]) continue
      work[i] = v
      if (recurse()) return true
      work[i] = 0
    }
    return false
  }
  return recurse() ? work : null
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Build a full solved board by randomized backtracking.
export function generateSolved(seed = Date.now()): number[] {
  const rng = mulberry32(seed)
  const board = new Array<number>(CELLS).fill(0)
  function findEmpty(): number {
    for (let i = 0; i < CELLS; i++) if (board[i] === 0) return i
    return -1
  }
  function recurse(): boolean {
    const i = findEmpty()
    if (i === -1) return true
    const used = new Uint8Array(10)
    for (const p of peersOf(i)) {
      const v = board[p] as number
      if (v) used[v] = 1
    }
    const order = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)
    for (const v of order) {
      if (used[v]) continue
      board[i] = v
      if (recurse()) return true
      board[i] = 0
    }
    return false
  }
  recurse()
  return board
}

const TARGET_GIVENS: Record<string, number> = {
  easy: 42,
  medium: 34,
  hard: 28,
  expert: 24,
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

export interface GeneratedPuzzle {
  puzzle: number[]
  solution: number[]
  givens: number
  difficulty: Difficulty
}

// Carve a unique puzzle from a solved board by removing pairs of cells (rotational symmetry)
// while uniqueness holds, until we hit the difficulty target or can't remove more.
export function generatePuzzle(difficulty: Difficulty, seed = Date.now()): GeneratedPuzzle {
  const target = TARGET_GIVENS[difficulty] ?? 30
  const solution = generateSolved(seed)
  const puzzle = solution.slice()
  const rng = mulberry32(seed ^ 0x9e3779b9)

  const order = shuffled(
    Array.from({ length: CELLS }, (_, i) => i),
    rng,
  )

  let givens = CELLS
  for (const i of order) {
    if (givens <= target) break
    const j = CELLS - 1 - i
    if (puzzle[i] === 0 && puzzle[j] === 0) continue
    const a = puzzle[i] as number
    const b = puzzle[j] as number
    puzzle[i] = 0
    puzzle[j] = 0
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[i] = a
      puzzle[j] = b
    } else {
      givens -= i === j ? 1 : 2
    }
  }

  return { puzzle, solution, givens, difficulty }
}