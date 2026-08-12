# Deploy DreamUtopia Clone — Workers staging (OpenNext)

**Stack in this branch:** Next.js App Router + Tailwind + shadcn/ui → OpenNext → **Cloudflare Workers** (B-line experiment).

B-line status, CI meaning, and A vs B API gaps: **[B-LINE.md](./B-LINE.md)**.  
**B-line agents: do not merge this PR and do not recommend cutting over live Pages.**

## Current production (do not assume cutover)

| Surface | What runs today |
|---|---|
| **Live site (A-line)** | Still **Cloudflare Pages**: [dreamutopia-clone.pages.dev](https://dreamutopia-clone.pages.dev) — static `out/` + Pages Functions (see `legacy/`) |
| **This PR / branch (B-line)** | Next.js Worker path — preview/staging via `npm run cf:deploy` |
| **Merging to `main`** | Does **not** by itself flip production. Pages keeps serving until dashboard / DNS / deploy target is changed on purpose. |
| **Cloudflare Pages check on this PR** | Expected **FAILURE** (no root `out/`). Not a B-line build failure — see B-LINE.md. |

Do **not** treat `npm run cf:deploy` as “replace production.” Deploy the Worker for smoke tests; keep Pages live.

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
curl -s https://<worker>.workers.dev/api/health | jq '{service,runtime,productionSurface,cutoverComplete,degraded,guestTrialsReady,kieConfigured}'
npm run check:health -- https://<worker>.workers.dev --expect-worker
```

Next Worker health includes `"runtime": "next-opennext-workers"`, `"productionSurface": "pages-until-cutover"`, soft `probes` / `degraded`, and `guestTrialsReady`. Legacy Pages health has no `runtime` field (or not that value). **`productionSurface` must stay `pages-until-cutover` while [dreamutopia-clone.pages.dev](https://dreamutopia-clone.pages.dev) is live** — do not flip it on deploy alone. Live traffic stays on Pages until the manual cutover below.

### Workers Builds (CI) — optional staging

| Setting | Value |
|---|---|
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Root | repo root |
| Node | 20+ |

Set Worker secrets in the dashboard (`wrangler secret` / Variables and Secrets). Build env vars do not replace secrets.

## CUTOVER — out of B-line scope (reference only)

**Not part of the B-line experiment.** Do not run this from PR #14 / B-line agents. Kept here only so a future explicit go decision has a checklist. Until then keep `productionSurface: "pages-until-cutover"` and `cutoverComplete: false` on the Worker.

1. **Preflight (staging Worker still OK)**  
   - `npm run verify` (`lint && build`)  
   - Worker secrets set (`KIE_API_KEY`; Stripe/Resend if needed)  
   - `npm run check:health -- https://<worker-host> --expect-worker` → `degraded: false`  
   - Real generate on Worker (empty KIE wallet → honest `kie_insufficient_balance`, not a fake video)

2. **Switch traffic**  
   - Point custom domain / routes at the **Worker** (not Pages)  
   - Pause or disconnect **Pages** git deploy so `main` merges cannot overwrite production with legacy `out/`

3. **Confirm live**  
   - `npm run check:health -- https://<live-host> --expect-worker`  
   - Spot-check: guest Lite try, signed-in generate, checkout **503** until Stripe is set

4. **After traffic is on Workers** (only then)  
   - Flip health tags in code: `productionSurface` away from `pages-until-cutover`, `cutoverComplete: true`  
   - Optionally retire [dreamutopia-clone.pages.dev](https://dreamutopia-clone.pages.dev)

**Warning:** Merging this Next.js tree into `main` while Pages still expects top-level `out/` will break Pages (snapshot is `legacy/out`). Cut over first, or keep Pages on a legacy branch until go.

### Pre-go staging checklist (safe anytime)

1. Branch green: `npm run lint`, `npm run build`, `npm run cf:preview` smoke OK  
2. `npm run cf:deploy` → Worker healthy (`runtime: next-opennext-workers`)  
3. Worker secrets set  
4. `check:health --expect-worker` — checkout **503** if Stripe unset; `degraded` false  
5. Funded KIE smoke generate on the Worker only (Pages stays live)

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
