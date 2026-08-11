# DreamUtopia Clone — Cloudflare Full Stack

1:1 clone of [dreamutopia.net](https://dreamutopia.net) — AI image-to-video generator, built with pure HTML/CSS/JS + Cloudflare Pages Functions.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Pure HTML + CSS + vanilla JS (no build step) |
| Hosting | Cloudflare Pages (unlimited bandwidth, free) |
| API | Cloudflare Pages Functions |
| Database | Cloudflare D1 (SQLite at the edge) |
| Sessions | Cloudflare KV |
| File Storage | Cloudflare R2 (zero egress) |
| Auth | Session token + KV + PBKDF2 (Web Crypto) |

## Project Structure

```
/out               # Static pages (build output dir)
  index.html       # Homepage (1:1 clone of DreamUtopia)
  pricing.html     # Pricing page
  workspace.html   # Generation workspace (wired to /api)
/functions/api     # Cloudflare Pages Functions (API routes)
  health.ts        # GET /api/health
  auth/            # register / login / logout / me
  credits.ts       # GET /api/credits
  generate.ts      # POST/GET /api/generate
  gallery.ts       # GET /api/gallery
  upload-ticket.ts # GET /api/upload-ticket
/libs              # Shared backend logic
  utils.ts         # Env types, JSON helpers, randomId
  auth.ts          # KV session management
  password.ts      # PBKDF2 hash/verify
/schema.sql        # D1 database schema
/wrangler.toml     # Cloudflare configuration
```

## D1 Schema

- `users` — email, password_hash, credits (10 free on signup)
- `generations` — prompt, model (lite/medium/pro), status, media_key, duration
- `gallery` — public showcase of generated works

## Deploy

1. `wrangler d1 create dreamutopia-db` → put database_id in wrangler.toml
2. `wrangler kv namespace create SESSIONS` → put id in wrangler.toml
3. `wrangler r2 bucket create dreamutopia-media`
4. `wrangler d1 execute dreamutopia-db --file=schema.sql`
5. Connect repo to Cloudflare Pages (build command: none, output dir: `out`) or `wrangler pages deploy out`

## Cost

| Item | Monthly Cost |
|---|---|
| Cloudflare Pages | $0 (free tier) |
| Cloudflare D1 | $0 (5GB free) |
| Cloudflare KV | $0 (1GB free) |
| Cloudflare R2 | $0 (10GB free) |
| **Total** | **$0** |
