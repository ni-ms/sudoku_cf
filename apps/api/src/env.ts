export interface Env {
  ROOM: DurableObjectNamespace
  DB: D1Database
  PUZZLES: KVNamespace
  JWT_SECRET: string
  ALLOWED_ORIGIN: string
}

export interface AuthVars {
  userId: string
  userName: string
}