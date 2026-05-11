import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WRANGLER_PATH = join(process.cwd(), 'apps/api/wrangler.toml');
const DEV_VARS_PATH = join(process.cwd(), 'apps/api/.dev.vars');

function run(cmd: string, silent = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
  } catch (e: any) {
    if (silent) return e.stdout || e.stderr || '';
    console.error(`Error running command: ${cmd}`);
    process.exit(1);
  }
}

function capture(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
  } catch (e: any) {
    return (e.stdout ?? '') + (e.stderr ?? '');
  }
}

function runWithInput(cmd: string, input: string): void {
  try {
    execSync(cmd, { input, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] });
  } catch {
    console.error(`Error running: ${cmd}`);
    process.exit(1);
  }
}

console.log('🚀 Starting Cloudflare Setup...');

// 1. Create D1 Database
console.log('\n📦 Checking D1 Database...');
const d1Output = capture('npx wrangler d1 create sudoku');
const d1IdMatch = d1Output.match(/database_id = "(.*)"/);

let d1Id: string | null = d1IdMatch ? d1IdMatch[1] : null;

if (!d1Id) {
  console.log('ℹ️  D1 might already exist. Fetching ID...');
  try {
    const d1List = JSON.parse(execSync('npx wrangler d1 list --json', { encoding: 'utf8' }));
    d1Id = d1List.find((db: any) => db.name === 'sudoku')?.uuid || null;
  } catch {
    console.error('❌ Failed to list D1 databases.');
    process.exit(1);
  }
}

// 2. Create KV Namespace
console.log('\n📂 Checking KV Namespace...');
const kvOutput = capture('npx wrangler kv namespace create PUZZLES');
const kvIdMatch = kvOutput.match(/id = "(.*)"/);

let kvId: string | null = kvIdMatch ? kvIdMatch[1] : null;

if (!kvId) {
  console.log('ℹ️  KV might already exist. Fetching ID...');
  try {
    const kvList = JSON.parse(execSync('npx wrangler kv namespace list', { encoding: 'utf8' }));
    kvId = kvList.find((kv: any) => kv.title.includes('PUZZLES'))?.id || null;
  } catch {
    console.error('❌ Failed to list KV namespaces.');
    process.exit(1);
  }
}

if (!d1Id || !kvId) {
  console.error('❌ Failed to retrieve IDs:', { d1Id, kvId });
  process.exit(1);
}

// 3. Update wrangler.toml
console.log('\n📝 Updating wrangler.toml...');
let config = readFileSync(WRANGLER_PATH, 'utf8');

if (config.includes('REPLACE_WITH_D1_ID')) {
  config = config.replace('REPLACE_WITH_D1_ID', d1Id);
} else {
  console.log('ℹ️  D1 ID already set in wrangler.toml, skipping.');
}

if (config.includes('REPLACE_WITH_KV_ID')) {
  config = config.replace('REPLACE_WITH_KV_ID', kvId);
} else {
  console.log('ℹ️  KV ID already set in wrangler.toml, skipping.');
}

writeFileSync(WRANGLER_PATH, config);

// 4. Generate and set JWT_SECRET on Cloudflare
console.log('\n🔑 Checking JWT_SECRET...');
let jwtSecretAlreadySet = false;
try {
  const raw = execSync('npx wrangler secret list --json 2>/dev/null', { encoding: 'utf8' }).trim();
  const list: Array<{ name: string }> = JSON.parse(raw || '[]');
  jwtSecretAlreadySet = list.some((s) => s.name === 'JWT_SECRET');
} catch {
  // not authenticated or no secrets yet — proceed to set
}

let jwtSecret: string;
if (jwtSecretAlreadySet) {
  console.log('ℹ️  JWT_SECRET already set on Cloudflare, skipping.');
  jwtSecret = '<already set>';
} else {
  jwtSecret = randomBytes(48).toString('base64');
  console.log('📤 Setting JWT_SECRET on Cloudflare...');
  runWithInput('npx wrangler secret put JWT_SECRET', jwtSecret);
  console.log('✅ JWT_SECRET set on Cloudflare.');
  console.log('');
  console.log('  ⚠️  Copy this value into a GitHub Actions secret so deployments keep it in sync:');
  console.log('     Repository → Settings → Secrets → Actions → New repository secret');
  console.log('     Name:  JWT_SECRET');
  console.log(`     Value: ${jwtSecret}`);
}

// 5. Create / update apps/api/.dev.vars for local development
console.log('\n📄 Checking apps/api/.dev.vars...');
let devVars = existsSync(DEV_VARS_PATH) ? readFileSync(DEV_VARS_PATH, 'utf8') : '';
let devVarsChanged = false;

if (!devVars.includes('JWT_SECRET=')) {
  const devSecret = randomBytes(32).toString('hex');
  devVars += (devVars && !devVars.endsWith('\n') ? '\n' : '') + `JWT_SECRET=${devSecret}\n`;
  devVarsChanged = true;
}

if (!devVars.includes('ALLOWED_ORIGIN=')) {
  devVars += `ALLOWED_ORIGIN=http://localhost:5173\n`;
  devVarsChanged = true;
}

if (devVarsChanged) {
  writeFileSync(DEV_VARS_PATH, devVars);
  console.log('✅ Created/updated apps/api/.dev.vars');
} else {
  console.log('ℹ️  apps/api/.dev.vars already complete.');
}

console.log('');
console.log('✅ Cloudflare setup complete!');
console.log(`   D1 ID : ${d1Id}`);
console.log(`   KV ID : ${kvId}`);
console.log('');
console.log('Next steps:');
console.log('  1. npm run migrate    — apply D1 migrations to production');
console.log('  2. npm run deploy     — build + deploy everything');
if (!jwtSecretAlreadySet) {
  console.log('  3. Add JWT_SECRET to GitHub Actions secrets (value printed above)');
}