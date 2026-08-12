# DreamUtopia Clone — Next.js + Tailwind + shadcn/ui

Cursor’s [dreamutopia.net](https://dreamutopia.net) image-to-video clone, migrated to:

**Next.js (App Router) · Tailwind CSS · shadcn/ui · Cloudflare Workers (OpenNext)**

> Not pikbo, not magicremover-clone.

## Why Cloudflare (not Vercel)

Production already has **D1** (`dreamutopia-db`), **KV** (`SESSIONS`), **R2** (`dreamutopia-media`), and **KIE / Stripe / Resend** secrets wired for this project. The generate, guest-trial, upload, and auth paths depend on those bindings.

Keeping **Cloudflare Workers via OpenNext** reuses the same bindings and secrets with the least product risk. A Vercel move would require replacing D1/KV/R2 (e.g. Postgres + Redis + S3) and rewriting session/guest/upload code — a larger, riskier cutover for no product gain.

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

## Build & deploy (Cloudflare)

```bash
# Build for Workers (OpenNext)
npm run preview   # build + local Workers runtime
npm run deploy    # build + deploy to Cloudflare Workers
```

Workers Builds / CI deploy command:

```bash
npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy
```

### Bindings & secrets

Same names as before (see **BACKEND.md**):

| Binding / secret | Required for |
|---|---|
| `DB` (D1) | auth, credits, history, checkout |
| `SESSIONS` (KV) | sessions, guest trials, rate limits |
| `MEDIA` (R2) | file upload |
| `KIE_API_KEY` | real generate |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | paid packs |
| `RESEND_API_KEY` + `MAIL_FROM` | password reset email |

```bash
npx wrangler secret put KIE_API_KEY
# optional:
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put MAIL_FROM
```

Apply schema / migrations on D1 as documented in **BACKEND.md** (`schema.sql`, `migrations/001`–`004`).

### Verify

```bash
curl -s https://<your-worker-host>/api/health | jq
```

Expect `authReady`, `kieConfigured`, `generateReady` when bindings + `KIE_API_KEY` are set. Checkout stays `checkoutConfigured: false` until Stripe secrets exist.

## Vercel (not chosen)

`npm run build` produces a standard Next.js build. Deploying to Vercel would work for the UI shell only; API routes that call `getCloudflareContext()` need Cloudflare bindings. Prefer Cloudflare for this product.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Next.js production build (CI / sanity) |
| `npm run preview` | OpenNext build + Workers preview |
| `npm run deploy` | OpenNext build + Workers deploy |
| `npm run cf-typegen` | Regenerate `cloudflare-env.d.ts` |
| `npm run lint` | ESLint |

## Cost

Cloudflare Pages/Workers + D1 + KV + R2 free tiers cover typical hobby traffic; KIE and Stripe are usage-based on your accounts.
