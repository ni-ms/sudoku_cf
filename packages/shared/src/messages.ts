import { z } from 'zod'
import { Player, PublicRoomState, Result } from './types'

export const CellIndex = z.number().int().min(0).max(80)
export const CellValue = z.number().int().min(0).max(9)
export const PencilValue = z.number().int().min(1).max(9)

export const ClientMessage = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), token: z.string() }),
  z.object({ t: z.literal('cursor'), cell: CellIndex }),
  z.object({ t: z.literal('place'), cell: CellIndex, value: CellValue }),
  z.object({ t: z.literal('pencil'), cell: CellIndex, value: PencilValue, on: z.boolean() }),
  z.object({ t: z.literal('ready') }),
])
export type ClientMessage = z.infer<typeof ClientMessage>

export const ServerMessage = z.discriminatedUnion('t', [
  z.object({ t: z.literal('state'), state: PublicRoomState }),
  z.object({ t: z.literal('player_join'), player: Player }),
  z.object({ t: z.literal('player_leave'), playerId: z.string() }),
  z.object({ t: z.literal('cursor'), playerId: z.string(), cell: CellIndex }),
  z.object({ t: z.literal('place_ok'), playerId: z.string(), cell: CellIndex, value: CellValue }),
  z.object({ t: z.literal('place_bad'), cell: CellIndex }),
  z.object({
    t: z.literal('pencil'),
    playerId: z.string(),
    cell: CellIndex,
    value: PencilValue,
    on: z.boolean(),
  }),
  z.object({ t: z.literal('start'), startedAt: z.number() }),
  z.object({
    t: z.literal('complete'),
    winnerId: z.string(),
    durationMs: z.number(),
    results: z.array(Result),
  }),
  z.object({ t: z.literal('progress'), playerId: z.string(), filled: z.number() }),
  z.object({ t: z.literal('error'), message: z.string() }),
])
export type ServerMessage = z.infer<typeof ServerMessage>