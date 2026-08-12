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
| File Storage | Cloudflare R2 (`MEDIA`) for start-image uploads |
| Auth | Session token + KV + PBKDF2 (Web Crypto) |

## Project Structure

```
/out               # Static pages (build output dir)
  index.html       # Homepage
  pricing.html     # Pricing (checkout not live — honest CTAs)
  workspace.html   # Generation workspace (upload + KIE)
  auth.html        # Login / register
  privacy.html     # Privacy
  terms.html       # Terms
/functions/api     # Cloudflare Pages Functions (API routes)
  health.ts        # GET /api/health
  auth/            # register / login / logout / me
  credits.ts       # GET /api/credits
  upload.ts        # GET probe + POST file → R2
  media.ts         # GET/HEAD /api/media?key= (public image bytes)
  generate.ts      # POST/GET /api/generate (KIE)
  gallery.ts       # GET /api/gallery
  checkout.ts      # GET/POST stub (503 checkout_not_configured)
  upload-ticket.ts # Legacy probe
/libs              # Shared backend logic
/schema.sql        # D1 database schema
/migrations        # D1 ALTER scripts for existing DBs
/wrangler.toml     # Cloudflare configuration
```

## Generate path

1. Sign up (10 credits) and open `/workspace`.
2. Upload a JPG/PNG/WebP/GIF (POST `/api/upload` → R2) **or** paste a public https image URL.
3. `POST /api/generate` deducts credits, calls KIE `kling-2.6/image-to-video`, stores the job in D1.
4. Client polls `GET /api/generate?id=…` until `status=done` and plays the provider `resultUrl`.
5. Image-only generation and paid checkout are **not live**.

## Backend setup

See **[BACKEND.md](./BACKEND.md)** for bindings, the `KIE_API_KEY` Pages secret, and D1 migration `001_generations_kie.sql`.

**Required for live generate:** `DB` + `SESSIONS` + `KIE_API_KEY`.  
**Required for file upload:** `MEDIA` / R2 (already bound in `wrangler.toml`).  
Public `imageUrl` still works without R2.

## Deploy

1. Follow BACKEND.md (D1/KV/R2 + schema/migration + `KIE_API_KEY` secret)
2. Bind `DB` / `SESSIONS` / `MEDIA` in Pages Settings
3. Connect repo to Cloudflare Pages (build command: none, output dir: `out`) or `wrangler pages deploy out`

`out/_routes.json` sends `/api/*` to Pages Functions so unknown API paths return Function responses instead of the homepage.

## Cost

| Item | Monthly Cost |
|---|---|
| Cloudflare Pages | $0 (free tier) |
| Cloudflare D1 | $0 (5GB free) |
| Cloudflare KV | $0 (1GB free) |
| Cloudflare R2 | $0 (10 GB storage / 1M Class A on free) |
| KIE API | usage-based (your KIE account) |
