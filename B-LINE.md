# DreamUtopia B-line (Workers / Next + shadcn)

**This document is for the B-line experiment only.**  
Live production remains **A-line Cloudflare Pages**. Do **not** merge this PR to flip production. Do **not** cut over [dreamutopia-clone.pages.dev](https://dreamutopia-clone.pages.dev) from this workstream.

| Line | Surface | Code |
|---|---|---|
| **A-line (live)** | Cloudflare Pages | `legacy/out` + `legacy/functions` (+ root `libs/` used by those Functions) |
| **B-line (this PR)** | Cloudflare Workers via OpenNext | repo root Next app + `src/server/**` + `wrangler.toml` |

Health tags on the Worker must stay:

- `runtime: "next-opennext-workers"`
- `productionSurface: "pages-until-cutover"`
- `cutoverComplete: false`

`npm run cf:deploy` is staging only. It does **not** replace Pages.

## CI signals on PR #14

| Check | Meaning |
|---|---|
| **GitHub Actions `B-line verify`** | Authoritative for this branch: `npm run verify` (`lint && build`). Must stay green. |
| **Cloudflare Pages** | **Expected FAILURE** on this branch. The Pages project still looks for A-line `out/` (+ Functions layout). This tree has Next at the root and snapshots A-line under `legacy/`. That red check is **not** a B-line build failure and must **not** be “fixed” by cutting production over to Workers. |

Do not change the Cloudflare Pages project to deploy OpenNext as a way to green that check. Keep Pages on the A-line layout until a separate, explicit cutover decision (out of scope for B-line).

## Local / branch quality gate

```bash
npm run verify          # lint && build — required green
npm run cf:preview      # optional OpenNext + local Workers runtime
npm run check:health -- https://dreamutopia-clone.pages.dev --expect-pages   # A-line live
# After staging deploy only:
npm run check:health -- https://<worker-host> --expect-worker
```

Staging Worker smoke (funded KIE, empty-wallet honesty) is still a manual gap until a Worker host is deployed and checked. That does **not** authorize production cutover.

## Auth / credits / generate — A vs B

Handlers live under `src/server/handlers/api/**` (B) vs `legacy/functions/api/**` (A snapshot). Business logic also has a root `libs/` mirror used by A-line Functions.

### Auth

| Area | Status |
|---|---|
| login / register / logout / me | **Parity** with A-line after import-path rewrite (`@/server/libs/*` vs relative `libs/`) |
| Sessions (KV) + D1 users | Same bindings / flow |
| Gap | Worker needs its **own** secrets/bindings; Pages secrets do not copy |

### Credits

| Area | Status |
|---|---|
| `credits` handler | **Parity** (path alias only vs A snapshot) |
| Ledger / balance / spend on generate | Same D1 model |
| Gap | Same shared D1 — prefer one writer stack at a time if both surfaces are live |

### Generate / guest / KIE

B-line is **ahead** of the A-line `legacy/functions/api/generate.ts` snapshot in several honesty and guest-KV hardenings. Root `libs/kie.ts` / `libs/guest.ts` largely track B libs; **A generate handler** and **`libs/settle.ts`** lag.

| Behavior | A-line snapshot (`legacy/functions`) | B-line (`src/server`) |
|---|---|---|
| Missing `KIE_API_KEY` | `kie_api_key_missing` (Pages-secret wording) | Same code + `fakeResult: false`; Worker-secret messaging in shared constants |
| Empty KIE wallet | Often generic `kie_create_failed` | Canonical `kie_insufficient_balance` via `isKieInsufficientBalance` |
| Insufficient site credits | Plain `{ error: "insufficient credits" }` | Structured `insufficient_credits` |
| Guest job list settle | Concurrent settles possible | Sequential settle + per-job try/catch |
| Guest KV shape | Older generate path | `normalizeGuestJobs` on read/list |
| Failed-guest IP refund on webhook | Weaker / request-IP only | `sourceIp` at create + settle re-load / refund via `sourceIp` |
| Health | Simple binding flags | `runtime`, probes, `degraded`, `guestTrialsReady`, cutover tags |

**Product gaps still open for B-line (not A-line regressions):**

1. Staging Worker not verified in CI (`--expect-worker` + real generate with funded KIE).
2. Stripe checkout remains intentionally **503** until Worker Stripe secrets are set (same honesty as Pages when unset).
3. A-line live Pages stays the production UX; B UI polish on this branch is not live until a future cutover (explicitly out of scope here).

## What B-line agents must not do

- Merge PR #14 into `main` to “finish” migration
- Recommend or perform DNS / custom-domain / Pages → Workers cutover
- Flip `productionSurface` / `cutoverComplete` while Pages is live
- “Fix” the Cloudflare Pages check by making Pages deploy the Next Worker
- Invent fake generate/checkout success when KIE/Stripe are missing or unpaid

## Related docs

- [README.md](./README.md) — stack overview  
- [DEPLOY.md](./DEPLOY.md) — Worker staging; cutover is **manual / out of B-line scope**  
- [BACKEND.md](./BACKEND.md) — bindings and API behavior  
- [legacy/README.md](./legacy/README.md) — A-line snapshot layout  
