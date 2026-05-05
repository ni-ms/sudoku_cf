// Client-side helpers — purely structural, never authoritative.

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

export function findConflicts(board: number[]): Set<number> {
  const conflicts = new Set<number>()
  for (let i = 0; i < CELLS; i++) {
    const v = board[i]
    if (!v) continue
    for (let j = 0; j < CELLS; j++) {
      if (i === j) continue
      if (board[j] !== v) continue
      if (rowOf(i) === rowOf(j) || colOf(i) === colOf(j) || boxOf(i) === boxOf(j)) {
        conflicts.add(i)
        conflicts.add(j)
      }
    }
  }
  return conflicts
}

export function sameDigitCells(board: number[], cell: number): Set<number> {
  const out = new Set<number>()
  const v = board[cell]
  if (!v) return out
  for (let i = 0; i < CELLS; i++) {
    if (board[i] === v) out.add(i)
  }
  return out
}

export function highlightedPeers(cell: number): Set<number> {
  const out = new Set<number>()
  const r = rowOf(cell)
  const c = colOf(cell)
  const b = boxOf(cell)
  for (let i = 0; i < CELLS; i++) {
    if (rowOf(i) === r || colOf(i) === c || boxOf(i) === b) out.add(i)
  }
  return out
}

export function isComplete(board: number[]): boolean {
  for (let i = 0; i < CELLS; i++) if (!board[i]) return false
  return findConflicts(board).size === 0
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}