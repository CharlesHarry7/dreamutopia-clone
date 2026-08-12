# DreamUtopia Clone — Next.js + Tailwind + shadcn/ui

Cursor’s [dreamutopia.net](https://dreamutopia.net) image-to-video clone, migrated in-repo to:

**Next.js (App Router) · Tailwind CSS · shadcn/ui · Cloudflare Workers (OpenNext)**

> Not pikbo, not magicremover-clone.

## Live site vs this branch (B-line)

| | |
|---|---|
| **Production today (A-line)** | Still **Cloudflare Pages**: [dreamutopia-clone.pages.dev](https://dreamutopia-clone.pages.dev) (`legacy/out` + Pages Functions) |
| **This codebase (B-line)** | Next + shadcn Worker path (`npm run cf:deploy`) — **staging / experiment only** |
| **Merging `main`** | Does **not** auto-cut over production. Blind merge while Pages still expects `out/` can break Pages. |
| **B-line status** | **[B-LINE.md](./B-LINE.md)** — CI meaning, A vs B auth/credits/generate gaps, no cutover |

Do **not** cut over live Pages from the B-line workstream. Worker health must keep `productionSurface: "pages-until-cutover"` and `cutoverComplete: false`.

## Why Cloudflare (not Vercel)

Production already has **D1** (`dreamutopia-db`), **KV** (`SESSIONS`), **R2** (`dreamutopia-media`), and **KIE / Stripe / Resend** secrets. The generate, guest-trial, upload, and auth paths depend on those bindings.

**OpenNext on Workers** reuses the same bindings with the least product risk. Vercel would require replacing D1/KV/R2 — a larger cutover for no product gain.

| Layer | Stack |
|---|---|
| Frontend | Next.js App Router + React + Tailwind + shadcn/ui |
| Hosting | Cloudflare Workers + Assets (OpenNext) |
| Database | Cloudflare D1 |
| Sessions / guest trials | Cloudflare KV (`SESSIONS`) |
| Media | Cloudflare R2 (`MEDIA`) |
| Inference | KIE Market API (`KIE_API_KEY`) |
| Payments | Stripe Checkout (optional — honest **503** when unset) |

Legacy static HTML + Pages Functions are preserved under `legacy/` for reference.

## Product capabilities (preserved)

- Auth (register / login / logout / me) + PBKDF2 passwords
- Guest trials: **2 Lite image-to-video** tries (KV cookie + IP)
- Signed-in credits + generate (T2V / I2V / first+last / stills)
- Upload to R2 or paste public `imageUrl`
- Gallery opt-in publish
- Checkout catalog + Stripe session when configured; otherwise **503 `configured: false`** (no fake charge)
- Password reset via Resend when configured
- EN / 中文 / 日本語 / Español i18n
- PWA manifest + service worker install banner
- `/robots.txt` + `/sitemap.xml`

## Project layout

```
src/app/                 # App Router pages + API routes
src/components/ui/       # shadcn/ui primitives
src/lib/                 # client api, auth, i18n
src/server/libs/         # D1/KV/R2/KIE/Stripe business logic
src/server/handlers/     # Migrated Pages Function handlers
src/server/cf.ts         # OpenNext getCloudflareContext adapter
public/                  # icons, images, manifest, sw.js
schema.sql + migrations/ # D1 schema
wrangler.toml            # Workers + D1/KV/R2 bindings
legacy/                  # Previous Pages static site + Functions
```

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`next.config.ts` calls `initOpenNextCloudflareForDev()` so route handlers can reach local/remote bindings defined in `wrangler.toml` (Wrangler login / API token required for remote D1/KV/R2).

Without bindings/secrets, UI still loads; `/api/health` reports readiness, and generate/checkout return honest errors (not fake demos).

## Build & deploy (Cloudflare Workers)

Staging Worker: **[DEPLOY.md](./DEPLOY.md)**. B-line verification / gaps: **[B-LINE.md](./B-LINE.md)**.  
Live production remains [dreamutopia-clone.pages.dev](https://dreamutopia-clone.pages.dev).  
`productionSurface` stays `pages-until-cutover`; `cutoverComplete` stays `false`.  
Use `npm run check:health -- <url> --expect-worker` (or `--expect-pages`) to tell the surfaces apart.  
`cf:deploy` does **not** replace Pages. Pages CI red on this PR is expected (see B-LINE.md).

```bash
npm run cf:preview   # OpenNext build + local Workers runtime
npm run cf:deploy    # deploy Worker only (Pages stays live)
npm run cf:secret:kie
npm run check:health -- https://<your-worker-host>
# Worker health should show: "runtime": "next-opennext-workers"
```

| Binding / secret | Required for |
|---|---|
| `DB` (D1) | auth, credits, history, checkout |
| `SESSIONS` (KV) | sessions, guest trials, rate limits |
| `MEDIA` (R2) | file upload |
| `KIE_API_KEY` | real generate (Workers secret — not Pages) |
| `STRIPE_*` / `RESEND_*` | optional paid packs / reset email |

D1: `npm run db:schema` (new) or `npm run db:migrate` (existing). See **BACKEND.md**.

Empty KIE wallet → `kie_insufficient_balance` (honest 502, no fake video). Checkout without Stripe → **503** `{ configured: false }`.

## Vercel (not chosen)

`npm run build` produces a standard Next.js build. Deploying to Vercel would work for the UI shell only; API routes that call `getCloudflareContext()` need Cloudflare bindings. Prefer Cloudflare for this product.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run verify` | `lint && build` (B-line CI gate) |
| `npm run build` / `lint` | Next production build / ESLint |
| `npm run cf:build` | OpenNext Workers build only |
| `npm run cf:preview` / `preview` | Build + local Workers runtime |
| `npm run cf:deploy` / `deploy` | Build + deploy Worker (staging; not Pages) |
| `npm run cf:secret:kie` | `wrangler secret put KIE_API_KEY` |
| `npm run db:schema` / `db:migrate` | Remote D1 schema / migrations |
| `npm run check:health` | Smoke `/api/health` + checkout honesty |
| `npm run cf:typegen` | Regenerate `cloudflare-env.d.ts` |

## Cost

Cloudflare Pages/Workers + D1 + KV + R2 free tiers cover typical hobby traffic; KIE and Stripe are usage-based on your accounts.
