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
| Inference | [KIE](https://kie.ai) Market API (`KIE_API_KEY` secret) |
| File Storage | Cloudflare R2 (**optional** — temp path uses public image URLs) |
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
  generate.ts      # POST/GET /api/generate (KIE, no R2 required)
  gallery.ts       # GET /api/gallery
  upload-ticket.ts # GET /api/upload-ticket (R2 readiness stub)
/libs              # Shared backend logic
  utils.ts         # Env types, JSON helpers, randomId
  kie.ts           # KIE createTask / recordInfo client
  auth.ts          # KV session management
  password.ts      # PBKDF2 hash/verify
/schema.sql        # D1 database schema
/migrations        # D1 ALTER scripts for existing DBs
/wrangler.toml     # Cloudflare configuration
```

## Generate path (temporary, no MEDIA)

1. User pastes a **public https image URL** in the workspace (file upload is preview-only until R2).
2. `POST /api/generate` deducts credits, calls KIE `kling-2.6/image-to-video`, stores the job in D1.
3. Client polls `GET /api/generate?id=…` until `status=done` and plays the provider `resultUrl`.
4. Missing `KIE_API_KEY` → structured `kie_api_key_missing` (503), not a demo alert.

## Backend setup

See **[BACKEND.md](./BACKEND.md)** for bindings, the `KIE_API_KEY` Pages secret, and D1 migration `001_generations_kie.sql`.

**Required for live generate:** `DB` + `SESSIONS` + `KIE_API_KEY`.  
**Not required:** `MEDIA` / R2.

## Deploy

1. Follow BACKEND.md (D1/KV + schema/migration + `KIE_API_KEY` secret)
2. Bind `DB` / `SESSIONS` in Pages Settings (MEDIA optional)
3. Connect repo to Cloudflare Pages (build command: none, output dir: `out`) or `wrangler pages deploy out`

## Cost

| Item | Monthly Cost |
|---|---|
| Cloudflare Pages | $0 (free tier) |
| Cloudflare D1 | $0 (5GB free) |
| Cloudflare KV | $0 (1GB free) |
| Cloudflare R2 | $0 (optional) |
| KIE API | usage-based (your KIE account) |
