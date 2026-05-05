// Set VITE_API_BASE_URL to your Worker's URL when the SPA is hosted separately
// (e.g. on Cloudflare Pages). Leave empty when using Workers Assets (same origin).
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

// Derives the correct WebSocket base URL from VITE_API_BASE_URL.
// Returns empty string when same-origin (uses window.location.host at runtime).
export function wsBase(): string {
  if (!API_BASE) return ''
  try {
    const u = new URL(API_BASE)
    return `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}`
  } catch {
    return ''
  }
}