# Deploy DreamUtopia Clone — Workers cutover (OpenNext)

**Stack in this branch:** Next.js App Router + Tailwind + shadcn/ui → OpenNext → **Cloudflare Workers**.

## Current production (do not assume cutover)

| Surface | What runs today |
|---|---|
| **Live site** | Still **Cloudflare Pages**: [dreamutopia-clone.pages.dev](https://dreamutopia-clone.pages.dev) — static `out/` + Pages Functions (see `legacy/`) |
| **This PR / branch** | Next.js Worker path — preview/staging via `npm run cf:deploy` |
| **Merging to `main`** | Does **not** by itself flip production. Pages keeps serving until dashboard / DNS / deploy target is changed on purpose. |

Do **not** treat `npm run cf:deploy` as “replace production.” Deploy the Worker for smoke tests; keep Pages live until an intentional cutover.

Shared data: D1 `dreamutopia-db`, KV `SESSIONS`, R2 `dreamutopia-media` (same IDs in `wrangler.toml`). Prefer one writer at a time on D1 once both stacks are live.

## Prerequisites

```bash
npm install
npx wrangler login
# or: export CLOUDFLARE_API_TOKEN=...
```

## One-time: D1 schema

```bash
npm run db:schema    # new DB
npm run db:migrate   # existing DB (001–004)
```

## Secrets (Workers ≠ Pages)

Pages secrets do **not** copy to the Worker. For the Worker named `dreamutopia-clone`:

```bash
npm run cf:secret:kie          # KIE_API_KEY
# optional:
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put MAIL_FROM
npx wrangler secret put KIE_WEBHOOK_HMAC_KEY
```

Empty KIE wallet → honest `kie_insufficient_balance` (502). No fake success video. Top up at [kie.ai](https://kie.ai).

## Local / staging Worker (safe while Pages stays live)

```bash
npm run cf:preview   # OpenNext build + local Workers runtime
npm run cf:deploy    # deploy Worker (workers.dev / Worker routes) — does not change Pages
npm run check:health -- https://<worker-host>
```

Aliases: `npm run preview` / `npm run deploy` → same as `cf:*`.

### Tell Pages vs Worker apart

```bash
# Live Pages (today) — no next-opennext-workers runtime
curl -s https://dreamutopia-clone.pages.dev/api/health | jq '{service,runtime,kieConfigured}'
npm run check:health -- https://dreamutopia-clone.pages.dev --expect-pages

# Next Worker (after cf:deploy) — staging only until cutover
curl -s https://<worker>.workers.dev/api/health | jq '{service,runtime,productionSurface,degraded,guestTrialsReady,kieConfigured}'
npm run check:health -- https://<worker>.workers.dev --expect-worker
```

Next Worker health includes `"runtime": "next-opennext-workers"`, `"productionSurface": "pages-until-cutover"`, soft `probes` / `degraded`, and `guestTrialsReady`. Legacy Pages health has no `runtime` field (or not that value). **Live traffic stays on Pages until the manual cutover below.**

### Workers Builds (CI) — optional staging

| Setting | Value |
|---|---|
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Root | repo root |
| Node | 20+ |

Set Worker secrets in the dashboard (`wrangler secret` / Variables and Secrets). Build env vars do not replace secrets.

## Manual cutover checklist (when ready — not automatic)

1. Branch green: `npm run lint`, `npm run build`, `npm run cf:preview` smoke OK  
2. `npm run cf:deploy` → Worker healthy (`runtime: next-opennext-workers`)  
3. Worker secrets set (`KIE_API_KEY`, optional Stripe/Resend)  
4. `npm run check:health -- https://<worker-host> --expect-worker` — checkout still **503** if Stripe unset; `degraded` must be false
5. Funded KIE wallet for a real generate (empty wallet → `kie_insufficient_balance`, expected)  
6. Point custom domain / traffic at the Worker  
7. Pause or disconnect **Pages** git deploy so `main` merges don’t fight the Worker  
8. Only then consider retiring [dreamutopia-clone.pages.dev](https://dreamutopia-clone.pages.dev)

**Warning:** Merging this Next.js tree into `main` while Pages is still configured for `out/` (no build, output `out`) will break the Pages deploy (there is no top-level `out/` anymore — snapshot is `legacy/out`). Either cut over to Workers first, or keep Pages on a legacy branch until cutover.

## Verify

```bash
npm run check:health -- https://<your-host>
curl -s -o /dev/null -w "%{http_code}\n" https://<your-host>/api/checkout   # 503 until Stripe
```

Healthy generate: `authReady` + `kieConfigured` + `generateReady`.  
Checkout without Stripe: **503** `{ configured: false }`.

## Common failures

| Symptom | Fix |
|---|---|
| `kie_api_key_missing` | `npm run cf:secret:kie` on the **Worker** |
| `kie_insufficient_balance` | Top up KIE — app will not invent a result |
| `bindings_missing` | `wrangler.toml` D1/KV + account access |
| `media_not_bound` | R2 `MEDIA`, or paste public `imageUrl` |
| `next start` API broken | Use `cf:preview` / Worker — needs OpenNext bindings |
| Pages 404 after merge | Pages still expects `out/` — follow cutover checklist; don’t merge blindly |
