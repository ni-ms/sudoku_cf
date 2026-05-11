// Set VITE_API_BASE_URL to your Worker's URL when the SPA is hosted separately
// (e.g. on Cloudflare Pages). Leave empty when using Workers Assets (same origin).
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

// In local dev, Vite's HTTP proxy forwards /api/* to wrangler fine, but its
// WebSocket proxy layer cannot complete the WS handshake against wrangler's DO
// runtime. Set VITE_WS_BASE to bypass the Vite proxy for WS only.
// setup-local.ts writes this automatically to apps/web/.env.development.local.
const WS_OVERRIDE = (import.meta.env.VITE_WS_BASE as string | undefined) ?? ''

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

// Returns the WebSocket origin to use for room connections.
// Priority: VITE_WS_BASE > derived from VITE_API_BASE_URL > '' (same-origin).
export function wsBase(): string {
  if (WS_OVERRIDE) return WS_OVERRIDE
  if (!API_BASE) return ''
  try {
    const u = new URL(API_BASE)
    return `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}`
  } catch {
    return ''
  }
}