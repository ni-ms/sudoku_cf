// Creates apps/api/.dev.vars and apps/web/.env.development.local for local
// development if they are missing or incomplete.
// Run once after cloning: npm run setup:local
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function ensureVars(filePath: string, required: Record<string, string>): void {
  let content = existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
  let changed = false
  for (const [key, value] of Object.entries(required)) {
    if (!content.includes(`${key}=`)) {
      content += (content && !content.endsWith('\n') ? '\n' : '') + `${key}=${value}\n`
      changed = true
    }
  }
  if (changed) {
    writeFileSync(filePath, content)
    console.log(`✅ Updated ${filePath}`)
  } else {
    console.log(`ℹ️  ${filePath} already set up`)
  }
}

// API worker secrets / vars
ensureVars(join(process.cwd(), 'apps/api/.dev.vars'), {
  JWT_SECRET: randomBytes(32).toString('hex'),
  ALLOWED_ORIGIN: 'http://localhost:5173',
})

// Web app: bypass Vite's WS proxy — connect WebSockets directly to wrangler dev.
// Vite's http-proxy layer cannot complete the WS handshake against wrangler's
// Durable Object runtime, so the connection closes before it is established.
// VITE_WS_BASE is ignored in prod builds (VITE_API_BASE_URL handles that case).
ensureVars(join(process.cwd(), 'apps/web/.env.development.local'), {
  VITE_WS_BASE: 'ws://localhost:8787',
})