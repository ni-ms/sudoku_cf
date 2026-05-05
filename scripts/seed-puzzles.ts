/**
 * Generate puzzles offline and push them into the KV namespace.
 *
 * Usage:
 *   tsx scripts/seed-puzzles.ts --difficulty=easy --count=100
 *   tsx scripts/seed-puzzles.ts --difficulty=medium --count=200 --remote
 *   tsx scripts/seed-puzzles.ts --difficulty=hard --count=50 --dry-run
 *
 * Without --remote, writes to local wrangler state. With --remote, writes to
 * the production KV namespace.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generatePuzzle, type Difficulty } from '../apps/api/src/lib/sudoku'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface Args {
  difficulty: Difficulty
  count: number
  remote: boolean
  dryRun: boolean
  startIndex: number
}

function parseArgs(): Args {
  const args: Args = {
    difficulty: 'medium',
    count: 50,
    remote: false,
    dryRun: false,
    startIndex: 0,
  }
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--difficulty=')) args.difficulty = a.slice(13) as Difficulty
    else if (a.startsWith('--count=')) args.count = Number(a.slice(8))
    else if (a.startsWith('--start=')) args.startIndex = Number(a.slice(8))
    else if (a === '--remote') args.remote = true
    else if (a === '--dry-run') args.dryRun = true
  }
  if (!['easy', 'medium', 'hard', 'expert'].includes(args.difficulty)) {
    throw new Error(`bad difficulty: ${args.difficulty}`)
  }
  if (!Number.isFinite(args.count) || args.count < 1) {
    throw new Error(`bad count: ${args.count}`)
  }
  return args
}

function kvPut(key: string, value: string, remote: boolean, dry: boolean): void {
  if (dry) {
    console.log(`[dry] would put ${key}`)
    return
  }
  const tmp = mkdtempSync(join(tmpdir(), 'sudoku-seed-'))
  const file = join(tmp, 'value.json')
  writeFileSync(file, value, 'utf8')
  try {
    const res = spawnSync(
      'npx',
      [
        'wrangler',
        'kv',
        'key',
        'put',
        '--binding=PUZZLES',
        remote ? '--remote' : '--local',
        key,
        `--path=${file}`,
      ],
      { cwd: join(__dirname, '..', 'apps', 'api'), stdio: 'inherit' },
    )
    if (res.status !== 0) throw new Error(`wrangler kv put failed for ${key}`)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function main() {
  const args = parseArgs()
  console.log(
    `Generating ${args.count} ${args.difficulty} puzzles (${args.remote ? 'remote' : 'local'})…`,
  )
  const start = Date.now()
  for (let i = 0; i < args.count; i++) {
    const idx = args.startIndex + i
    const padded = String(idx).padStart(4, '0')
    const seed = Date.now() + i * 1009
    const p = generatePuzzle(args.difficulty, seed)
    const value = JSON.stringify({
      puzzle: p.puzzle,
      solution: p.solution,
      givens: p.givens,
    })
    kvPut(`puzzles:${args.difficulty}:${padded}`, value, args.remote, args.dryRun)
    console.log(`  [${i + 1}/${args.count}] ${padded} (${p.givens} givens)`)
  }
  const total = args.startIndex + args.count
  kvPut(`puzzles:${args.difficulty}:count`, String(total), args.remote, args.dryRun)
  console.log(
    `Done in ${((Date.now() - start) / 1000).toFixed(1)}s. count=${total}`,
  )
}

main()