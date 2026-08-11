# TaleTok Clone — Cloudflare Full Stack

1:1 clone of [taletok.io](https://taletok.io) built with Next.js static export + Cloudflare Pages.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (static export) + TypeScript + Tailwind CSS |
| Hosting | Cloudflare Pages (unlimited bandwidth, free) |
| API | Cloudflare Pages Functions |
| Database | Cloudflare D1 (SQLite at the edge) |
| Cache/Sessions | Cloudflare KV |
| File Storage | Cloudflare R2 (zero egress) |
| Payments | Stripe (via Workers fetch API) |
| Email | Resend |
| Auth | JWT + KV (magic link) |

## Project Structure

```
/app              # Next.js static pages (exported to /out)
/components       # React UI components (12 sections)
/functions/api    # Cloudflare Pages Functions (API routes)
/libs             # Shared backend logic (db, auth, stripe, email)
/schema.sql       # D1 database schema
/wrangler.toml    # Cloudflare configuration
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run dev server (frontend only)
npm run dev

# 3. Build static export
npm run build

# 4. Run with Cloudflare local dev (frontend + API + D1 + KV)
npm start

# 5. Initialize D1 database
npm run db:init
```

## Deploy to Cloudflare

```bash
# Set secrets
npx wrangler pages secret put STRIPE_SECRET_KEY
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET
npx wrangler pages secret put RESEND_API_KEY
npx wrangler pages secret put JWT_SECRET

# Deploy
npm run deploy
```

## Cost

| Item | Monthly Cost |
|---|---|
| Cloudflare Pages | $0 (free tier) |
| Cloudflare D1 | $0 (5GB free) |
| Cloudflare KV | $0 (1GB free) |
| Cloudflare R2 | $0 (10GB free) |
| Bandwidth | $0 (unlimited free) |
| **Total** | **$0** |

Stripe charges 2.9% + 30c per transaction. Resend free tier: 3,000 emails/month.
