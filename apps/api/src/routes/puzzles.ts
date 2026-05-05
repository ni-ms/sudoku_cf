import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { Difficulty, PUZZLE_LEN } from '@sudoku-cf/shared'
import type { Env } from '../env'
import { generatePuzzle } from '../lib/sudoku'

const Query = z.object({ difficulty: Difficulty.default('medium') })

export const puzzleRoutes = new Hono<{ Bindings: Env }>().get(
  '/random',
  zValidator('query', Query),
  async (c) => {
    const { difficulty } = c.req.valid('query')
    const countRaw = await c.env.PUZZLES.get(`puzzles:${difficulty}:count`)
    const count = Number(countRaw ?? 0)

    if (count > 0) {
      const idx = Math.floor(Math.random() * count)
      const padded = String(idx).padStart(4, '0')
      const json = await c.env.PUZZLES.get(`puzzles:${difficulty}:${padded}`, 'json')
      if (json && typeof json === 'object') {
        const obj = json as { puzzle: number[]; solution: number[] }
        if (obj.puzzle?.length === PUZZLE_LEN) {
          return c.json({ difficulty, puzzle: obj.puzzle })
        }
      }
    }

    // Fallback: generate live. Slow path; only when KV is empty.
    const p = generatePuzzle(difficulty)
    return c.json({ difficulty, puzzle: p.puzzle })
  },
)