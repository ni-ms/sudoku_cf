import { z } from 'zod'

export const Difficulty = z.enum(['easy', 'medium', 'hard', 'expert'])
export type Difficulty = z.infer<typeof Difficulty>

export const Mode = z.enum(['race', 'coop'])
export type Mode = z.infer<typeof Mode>

export const Player = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  joinedAt: z.number(),
})
export type Player = z.infer<typeof Player>

export const Result = z.object({
  playerId: z.string(),
  name: z.string(),
  finishedAt: z.number().nullable(),
  errors: z.number(),
  durationMs: z.number().nullable(),
})
export type Result = z.infer<typeof Result>

export const PublicRoomState = z.object({
  roomId: z.string(),
  mode: Mode,
  difficulty: Difficulty,
  puzzle: z.array(z.number()).length(81),
  players: z.array(Player),
  cursors: z.record(z.string(), z.number()),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
  winnerId: z.string().nullable(),
  yourBoard: z.array(z.number()).length(81).optional(),
  yourPencil: z.array(z.array(z.number())).length(81).optional(),
})
export type PublicRoomState = z.infer<typeof PublicRoomState>

export const CreateRoomBody = z.object({
  mode: Mode.default('race'),
  difficulty: Difficulty.default('medium'),
})
export type CreateRoomBody = z.infer<typeof CreateRoomBody>

export const GuestAuthBody = z.object({
  name: z.string().min(1).max(24),
})
export type GuestAuthBody = z.infer<typeof GuestAuthBody>

export const PUZZLE_LEN = 81

export const PLAYER_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
] as const