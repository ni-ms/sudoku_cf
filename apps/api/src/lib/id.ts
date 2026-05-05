// Short, human-friendly room codes (6 chars, no ambiguous letters).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function newRoomCode(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < 6; i++) {
    const b = bytes[i] as number
    out += ALPHABET[b % ALPHABET.length]
  }
  return out
}

export function newUserId(): string {
  return crypto.randomUUID()
}