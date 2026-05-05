import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WRANGLER_PATH = join(process.cwd(), 'apps/api/wrangler.toml');

function run(cmd: string, silent = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
  } catch (e: any) {
    if (silent) return e.stdout || e.stderr || '';
    console.error(`Error running command: ${cmd}`);
    process.exit(1);
  }
}

// Special run for capture that doesn't exit on error
function capture(cmd: string) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
  } catch (e: any) {
    return e.stdout + e.stderr;
  }
}

console.log('🚀 Starting Cloudflare Setup...');

// 1. Create D1 Database
console.log('📦 Checking D1 Database...');
const d1Output = capture('npx wrangler d1 create sudoku');
const d1IdMatch = d1Output.match(/database_id = "(.*)"/);

let d1Id: string | null = d1IdMatch ? d1IdMatch[1] : null;

if (!d1Id) {
  console.log('ℹ️ D1 might already exist. Fetching ID...');
  try {
    const d1List = JSON.parse(execSync('npx wrangler d1 list --json', { encoding: 'utf8' }));
    d1Id = d1List.find((db: any) => db.name === 'sudoku')?.uuid || null;
  } catch (e) {
    console.error('❌ Failed to list D1 databases.');
    process.exit(1);
  }
}

// 2. Create KV Namespace
console.log('📂 Checking KV Namespace...');
const kvOutput = capture('npx wrangler kv namespace create PUZZLES');
const kvIdMatch = kvOutput.match(/id = "(.*)"/);

let kvId: string | null = kvIdMatch ? kvIdMatch[1] : null;

if (!kvId) {
  console.log('ℹ️ KV might already exist. Fetching ID...');
  try {
    const kvList = JSON.parse(execSync('npx wrangler kv namespace list', { encoding: 'utf8' }));
    // Title usually contains the name we provided
    kvId = kvList.find((kv: any) => kv.title.includes('PUZZLES'))?.id || null;
  } catch (e) {
    console.error('❌ Failed to list KV namespaces.');
    process.exit(1);
  }
}

if (!d1Id || !kvId) {
  console.error('❌ Failed to retrieve IDs:', { d1Id, kvId });
  process.exit(1);
}

// 3. Update wrangler.toml
console.log('📝 Updating wrangler.toml...');
let config = readFileSync(WRANGLER_PATH, 'utf8');

// Use global replace or handle if already replaced
if (config.includes('REPLACE_WITH_D1_ID')) {
    config = config.replace('REPLACE_WITH_D1_ID', d1Id);
} else {
    console.log('ℹ️ D1 ID already set in wrangler.toml, skipping update.');
}

if (config.includes('REPLACE_WITH_KV_ID')) {
    config = config.replace('REPLACE_WITH_KV_ID', kvId);
} else {
    console.log('ℹ️ KV ID already set in wrangler.toml, skipping update.');
}

writeFileSync(WRANGLER_PATH, config);

console.log('✅ Cloudflare setup complete!');
console.log(`   D1 ID: ${d1Id}`);
console.log(`   KV ID: ${kvId}`);
console.log('\nNext steps:');
console.log('1. npm run migrate (to apply migrations to production)');
console.log('2. npm run deploy (to deploy everything)');
