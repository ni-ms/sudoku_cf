import {
  type ClientMessage,
  ClientMessage as ClientMessageSchema,
  type Difficulty,
  type Mode,
  type Player,
  PLAYER_COLORS,
  PUZZLE_LEN,
  type PublicRoomState,
  type Result,
  type ServerMessage,
} from '@sudoku-cf/shared'
import type { Env } from '../env'
import { generatePuzzle, isComplete } from '../lib/sudoku'
import { verifyToken } from '../lib/jwt'

type PlayerId = string

interface PersistedRoomState {
  roomId: string
  mode: Mode
  difficulty: Difficulty
  puzzle: number[]
  solution: number[]
  boards: Record<PlayerId, number[]>
  pencil: Record<PlayerId, number[][]>
  cursors: Record<PlayerId, number>
  errors: Record<PlayerId, number>
  finishedBy: Record<PlayerId, number>
  players: Record<PlayerId, Player>
  startedAt: number | null
  finishedAt: number | null
  winnerId: string | null
  ready: Record<PlayerId, boolean>
  initialized: boolean
}

interface SocketAttachment {
  playerId: string
  name: string
  authed: boolean
}

const IDLE_CLEANUP_MS = 30 * 60 * 1000

function emptyBoard(): number[] {
  return new Array<number>(PUZZLE_LEN).fill(0)
}

function emptyPencil(): number[][] {
  return Array.from({ length: PUZZLE_LEN }, () => [])
}

export class RoomDO implements DurableObject {
  private state: DurableObjectState
  private env: Env
  private cache: PersistedRoomState | null = null

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/init' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { roomId: string; mode: Mode; difficulty: Difficulty }
        await this.init(body.roomId, body.mode, body.difficulty)
        return Response.json({ ok: true })
      } catch (e) {
        console.error('DO: init error', e)
        return Response.json({ error: String(e) }, { status: 500 })
      }
    }

    if (url.pathname === '/meta') {
      const s = await this.load()
      if (!s.initialized) return new Response('not found', { status: 404 })
      return Response.json({
        roomId: s.roomId,
        mode: s.mode,
        difficulty: s.difficulty,
        players: Object.values(s.players),
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
      })
    }

    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      return this.handleUpgrade(request)
    }

    return new Response('not found', { status: 404 })
  }

  // --- state plumbing ---

  private async load(): Promise<PersistedRoomState> {
    if (this.cache) return this.cache
    const stored = await this.state.storage.get<PersistedRoomState>('state')
    if (stored) {
      this.cache = stored
      return stored
    }
    const empty: PersistedRoomState = {
      roomId: '',
      mode: 'race',
      difficulty: 'medium',
      puzzle: emptyBoard(),
      solution: emptyBoard(),
      boards: {},
      pencil: {},
      cursors: {},
      errors: {},
      finishedBy: {},
      players: {},
      startedAt: null,
      finishedAt: null,
      winnerId: null,
      ready: {},
      initialized: false,
    }
    this.cache = empty
    return empty
  }

  private async save(): Promise<void> {
    if (!this.cache) return
    await this.state.storage.put('state', this.cache)
  }

  private async init(roomId: string, mode: Mode, difficulty: Difficulty): Promise<void> {
    const s = await this.load()
    if (s.initialized) return

    let puzzle: number[] | null = null
    let solution: number[] | null = null

    const countRaw = await this.env.PUZZLES.get(`puzzles:${difficulty}:count`)
    const count = Number(countRaw ?? 0)
    if (count > 0) {
      const idx = Math.floor(Math.random() * count)
      const padded = String(idx).padStart(4, '0')
      const json = (await this.env.PUZZLES.get(`puzzles:${difficulty}:${padded}`, 'json')) as
        | { puzzle: number[]; solution: number[] }
        | null
      if (json?.puzzle?.length === PUZZLE_LEN && json.solution?.length === PUZZLE_LEN) {
        puzzle = json.puzzle
        solution = json.solution
      }
    }

    if (!puzzle || !solution) {
      console.log(`DO: no puzzles in KV for ${difficulty}, generating live...`)
      const g = generatePuzzle(difficulty)
      puzzle = g.puzzle
      solution = g.solution
    }

    s.roomId = roomId
    s.mode = mode
    s.difficulty = difficulty
    s.puzzle = puzzle
    s.solution = solution
    s.initialized = true
    await this.save()
    await this.state.storage.setAlarm(Date.now() + IDLE_CLEANUP_MS)
  }

  // --- WebSocket upgrade ---

  private async handleUpgrade(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return new Response('missing token', { status: 401 })
    const claims = await verifyToken(token, this.env.JWT_SECRET)
    if (!claims) return new Response('bad token', { status: 401 })

    const s = await this.load()
    if (!s.initialized) {
      console.error(`DO: room not initialized for ${url.pathname}`)
      return new Response('room not initialized', { status: 404 })
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    const playerId = claims.sub
    const attach: SocketAttachment = { playerId, name: claims.name, authed: true }
    server.serializeAttachment(attach)

    try {
      this.state.acceptWebSocket(server)
      await this.onJoin(server, playerId, claims.name)
    } catch (e) {
      console.error('DO: accept/onJoin error', e)
      return new Response('internal error', { status: 500 })
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  private async onJoin(ws: WebSocket, playerId: string, name: string): Promise<void> {
    const s = await this.load()
    const isNew = !s.players[playerId]
    if (isNew) {
      const colorIdx = Object.keys(s.players).length % PLAYER_COLORS.length
      const player: Player = {
        id: playerId,
        name,
        color: PLAYER_COLORS[colorIdx] ?? '#3b82f6',
        joinedAt: Date.now(),
      }
      s.players[playerId] = player
      s.boards[playerId] = s.puzzle.slice()
      s.pencil[playerId] = emptyPencil()
      s.errors[playerId] = 0
      s.cursors[playerId] = 0
      await this.save()
      this.broadcast({ t: 'player_join', player }, ws)
    }

    const publicState = this.publicStateFor(playerId, s)
    this.send(ws, { t: 'state', state: publicState })

    // Auto-start in race mode when first player connects (simpler than ready handshake for v1)
    if (!s.startedAt && s.mode === 'race') {
      s.startedAt = Date.now()
      await this.save()
      this.broadcast({ t: 'start', startedAt: s.startedAt })
    }
  }

  private publicStateFor(playerId: string, s: PersistedRoomState): PublicRoomState {
    return {
      roomId: s.roomId,
      mode: s.mode,
      difficulty: s.difficulty,
      puzzle: s.puzzle,
      players: Object.values(s.players),
      cursors: { ...s.cursors },
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      winnerId: s.winnerId,
      yourBoard: s.boards[playerId]?.slice() ?? s.puzzle.slice(),
      yourPencil: s.pencil[playerId]?.map((p) => p.slice()) ?? emptyPencil(),
    }
  }

  // --- WebSocket lifecycle (hibernation API) ---

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const att = (ws.deserializeAttachment() ?? null) as SocketAttachment | null
    if (!att) {
      ws.close(1008, 'no attachment')
      return
    }
    let msg: ClientMessage
    try {
      const parsed = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw))
      msg = ClientMessageSchema.parse(parsed)
    } catch {
      this.send(ws, { t: 'error', message: 'bad message' })
      return
    }

    switch (msg.t) {
      case 'hello':
        // Already authed at upgrade; nothing to do.
        return
      case 'cursor':
        await this.handleCursor(att.playerId, msg.cell)
        return
      case 'place':
        await this.handlePlace(ws, att.playerId, msg.cell, msg.value)
        return
      case 'pencil':
        await this.handlePencil(att.playerId, msg.cell, msg.value, msg.on)
        return
      case 'ready':
        // Reserved for future ready/start handshake.
        return
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    const att = (ws.deserializeAttachment() ?? null) as SocketAttachment | null
    if (!att) return
    const remainingForPlayer = this.state
      .getWebSockets()
      .filter((s) => {
        const a = (s.deserializeAttachment() ?? null) as SocketAttachment | null
        return a?.playerId === att.playerId && s !== ws
      }).length
    if (remainingForPlayer === 0) {
      this.broadcast({ t: 'player_leave', playerId: att.playerId })
    }
  }

  async webSocketError(ws: WebSocket, _err: unknown) {
    try {
      ws.close(1011, 'error')
    } catch {
      /* ignore */
    }
  }

  async alarm(): Promise<void> {
    const sockets = this.state.getWebSockets()
    if (sockets.length === 0) {
      await this.state.storage.deleteAll()
      this.cache = null
      return
    }
    await this.state.storage.setAlarm(Date.now() + IDLE_CLEANUP_MS)
  }

  // --- handlers ---

  private async handleCursor(playerId: string, cell: number): Promise<void> {
    const s = await this.load()
    s.cursors[playerId] = cell
    await this.save()
    this.broadcast({ t: 'cursor', playerId, cell })
  }

  private async handlePlace(
    ws: WebSocket,
    playerId: string,
    cell: number,
    value: number,
  ): Promise<void> {
    const s = await this.load()
    if (s.finishedAt) return
    if (s.puzzle[cell] !== 0) {
      this.send(ws, { t: 'place_bad', cell })
      return
    }
    const board = s.boards[playerId]
    if (!board) return

    if (value === 0) {
      board[cell] = 0
      await this.save()
      this.broadcastProgress(playerId, s)
      this.send(ws, { t: 'place_ok', playerId, cell, value })
      return
    }

    const expected = s.solution[cell]
    if (value !== expected) {
      s.errors[playerId] = (s.errors[playerId] ?? 0) + 1
      await this.save()
      this.send(ws, { t: 'place_bad', cell })
      return
    }

    board[cell] = value
    await this.save()
    this.send(ws, { t: 'place_ok', playerId, cell, value })
    this.broadcastProgress(playerId, s)

    if (isComplete(board) && !s.finishedBy[playerId]) {
      s.finishedBy[playerId] = Date.now()
      if (!s.winnerId) {
        s.winnerId = playerId
        s.finishedAt = Date.now()
      }
      await this.save()
      await this.maybeFinishGame(s)
    }
  }

  private async handlePencil(
    playerId: string,
    cell: number,
    value: number,
    on: boolean,
  ): Promise<void> {
    const s = await this.load()
    const marks = s.pencil[playerId]
    if (!marks) return
    const cellMarks = marks[cell] ?? []
    const idx = cellMarks.indexOf(value)
    if (on && idx === -1) cellMarks.push(value)
    if (!on && idx !== -1) cellMarks.splice(idx, 1)
    marks[cell] = cellMarks
    await this.save()
    // Pencil marks are private per-player; no broadcast needed.
  }

  private broadcastProgress(playerId: string, s: PersistedRoomState): void {
    const board = s.boards[playerId]
    if (!board) return
    let filled = 0
    for (let i = 0; i < PUZZLE_LEN; i++) if (board[i]) filled++
    this.broadcast({ t: 'progress', playerId, filled })
  }

  private async maybeFinishGame(s: PersistedRoomState): Promise<void> {
    const start = s.startedAt ?? Date.now()
    const durationMs = (s.finishedAt ?? Date.now()) - start
    const results: Result[] = Object.values(s.players).map((p) => {
      const fin = s.finishedBy[p.id] ?? null
      return {
        playerId: p.id,
        name: p.name,
        finishedAt: fin,
        errors: s.errors[p.id] ?? 0,
        durationMs: fin ? fin - start : null,
      }
    })

    this.broadcast({
      t: 'complete',
      winnerId: s.winnerId ?? '',
      durationMs,
      results,
    })

    if (s.winnerId) {
      try {
        await this.env.DB.prepare(
          'INSERT OR REPLACE INTO games (room_id, mode, difficulty, started_at, finished_at, duration_ms, winner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
          .bind(s.roomId, s.mode, s.difficulty, start, s.finishedAt ?? Date.now(), durationMs, s.winnerId)
          .run()
        const stmt = this.env.DB.prepare(
          'INSERT OR REPLACE INTO game_players (room_id, user_id, name, finished_at, errors) VALUES (?, ?, ?, ?, ?)',
        )
        await this.env.DB.batch(
          results.map((r) =>
            stmt.bind(s.roomId, r.playerId, r.name, r.finishedAt, r.errors),
          ),
        )
      } catch (e) {
        console.error('failed to persist game', e)
      }
    }
  }

  // --- send helpers ---

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg))
    } catch (e) {
      console.error('DO: send error', e)
    }
  }

  private broadcast(msg: ServerMessage, except?: WebSocket): void {
    try {
      const data = JSON.stringify(msg)
      for (const ws of this.state.getWebSockets()) {
        if (ws === except) continue
        try {
          ws.send(data)
        } catch (e) {
          console.error('DO: broadcast error', e)
        }
      }
    } catch (e) {
      console.error('DO: broadcast stringify error', e)
    }
  }
}