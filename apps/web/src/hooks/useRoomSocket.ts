import { useEffect, useRef } from 'react'
import { ServerMessage, type ClientMessage } from '@sudoku-cf/shared'
import { useGameStore } from '../store/gameStore'
import { wsBase } from '../lib/config'

interface Options {
  roomId: string
  token: string
  myId: string
  onConnected?: () => void
  onError?: (msg: string) => void
}

export function useRoomSocket({ roomId, token, myId, onConnected, onError }: Options) {
  const wsRef = useRef<WebSocket | null>(null)
  const send = useRef((msg: ClientMessage) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(msg))
  })

  useEffect(() => {
    const defaultProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsOrigin = wsBase() || `${defaultProto}//${window.location.host}`
    const url = `${wsOrigin}/api/rooms/${roomId}/ws?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => onConnected?.()
    ws.onerror = () => onError?.('WebSocket connection error')
    ws.onclose = (ev) => {
      if (ev.code !== 1000 && ev.code !== 1001) {
        const reason = ev.reason ? `${ev.code}: ${ev.reason}` : `code ${ev.code}`
        onError?.(`connection closed (${reason})`)
      }
    }
    ws.onmessage = (ev) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(ev.data as string)
      } catch {
        return
      }
      const result = ServerMessage.safeParse(parsed)
      if (!result.success) return
      const msg = result.data
      const store = useGameStore.getState()
      switch (msg.t) {
        case 'state':
          store.loadFromState(msg.state, myId)
          return
        case 'player_join':
          store.applyPlayerJoin(msg.player)
          return
        case 'player_leave':
          store.applyPlayerLeave(msg.playerId)
          return
        case 'cursor':
          store.applyRemoteCursor(msg.playerId, msg.cell)
          return
        case 'place_ok':
          // Server confirms move; if it's our own, value is already optimistic — no-op.
          return
        case 'place_bad':
          store.markWrong(msg.cell)
          return
        case 'pencil':
          // Pencil marks are private; ignore if from another player.
          return
        case 'progress':
          store.applyProgress(msg.playerId, msg.filled)
          return
        case 'start':
          store.setStarted(msg.startedAt)
          return
        case 'complete':
          store.setComplete(
            msg.winnerId,
            msg.results.map((r) => ({
              playerId: r.playerId,
              name: r.name,
              durationMs: r.durationMs,
              errors: r.errors,
            })),
          )
          return
        case 'error':
          onError?.(msg.message)
          return
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, token, myId])

  return { send: send.current }
}