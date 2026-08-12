# Deploy DreamUtopia Clone on Cloudflare Workers (OpenNext)

This app is **Next.js → OpenNext → Cloudflare Workers**, not Cloudflare Pages git deploys.

Bindings stay the same as the old Pages project: D1 `dreamutopia-db`, KV `SESSIONS`, R2 `dreamutopia-media`.

## Prerequisites

```bash
npm install
npx wrangler login
# or: export CLOUDFLARE_API_TOKEN=...
```

Confirm `wrangler.toml` has the real D1/KV/R2 IDs (already filled for this repo).

## One-time: D1 schema

New database:

```bash
npm run db:schema
```

Existing database (also run migrations):

```bash
npm run db:migrate
```

## Secrets (Workers, not Pages)

Pages secrets do **not** automatically apply to the Worker. Set them on the Worker named `dreamutopia-clone`:

```bash
npm run cf:secret:kie          # prompts for KIE_API_KEY
# optional paid packs / email:
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put MAIL_FROM
npx wrangler secret put KIE_WEBHOOK_HMAC_KEY
```

Empty KIE wallet: generate returns honest `kie_insufficient_balance` (502) — no fake success video. Top up at [kie.ai](https://kie.ai).

## Local Workers preview

```bash
npm run cf:preview
# = opennextjs-cloudflare build && opennextjs-cloudflare preview
```

## Deploy

```bash
npm run cf:deploy
# = opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

Aliases: `npm run deploy` and `npm run preview` do the same.

### Workers Builds (CI)

| Setting | Value |
|---|---|
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Root directory | repo root |
| Node | 20+ |

Also set Worker secrets in the dashboard (Build Variables do not replace `wrangler secret`).

## Cutover from Pages (`*.pages.dev`)

1. Deploy Worker (`npm run cf:deploy`) — reuses D1/KV/R2 IDs in `wrangler.toml`
2. Put `KIE_API_KEY` (and optional Stripe/Resend) on the **Worker**
3. Point custom domain / smoke-test `https://<worker>.workers.dev/api/health`
4. Leave Pages project idle or delete after traffic moves — do not keep two writers on the same D1 without a plan

## Verify

```bash
npm run check:health -- https://<your-host>
# or:
curl -s https://<your-host>/api/health | jq
curl -s -o /dev/null -w "%{http_code}\n" https://<your-host>/api/checkout   # expect 503 until Stripe
```

Healthy generate path: `authReady` + `kieConfigured` + `generateReady`.  
Checkout without Stripe: **503** `{ configured: false }` (honest — no fake charge).

## Common failures

| Symptom | Fix |
|---|---|
| `kie_api_key_missing` | `npm run cf:secret:kie` then redeploy/restart |
| `kie_insufficient_balance` | Top up KIE wallet — app will not invent a result |
| `bindings_missing` | Confirm D1/KV in `wrangler.toml` + account access |
| `media_not_bound` | R2 `MEDIA` binding; or paste public `imageUrl` |
| UI builds but API 500 in `next start` | Use `cf:preview` / Workers — bindings need OpenNext runtime |
