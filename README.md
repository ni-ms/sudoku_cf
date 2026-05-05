# sudoku-cf

I just wanted to create something with cloudflare's serverless stack, so I made a sudoku game.

## Layout

```
apps/api    Hono Worker + RoomDO + D1 + KV
apps/web    React + Vite + Tailwind frontend
packages/shared   Shared types + zod schemas
scripts/    Puzzle seeding
```

## Quickstart

```bash
npm install

# In one terminal — API at http://localhost:8787
npm run dev:api

# In another — web at http://localhost:5173
npm run dev:web
```

## Setup before deploy

1. Create D1 + KV bindings and paste the IDs into `apps/api/wrangler.toml`.
1.1. There is an npm script to generate this 
2. Apply migrations: `cd apps/api && npx wrangler d1 migrations apply sudoku --local` (drop `--local` for prod).
3. Seed puzzles: `npm run seed:puzzles -- --difficulty=easy --count=100`.
4. Deploy: `npm run deploy:api`.
5. Build web: `npm run build:web`, then deploy `apps/web/dist` to Cloudflare Pages.