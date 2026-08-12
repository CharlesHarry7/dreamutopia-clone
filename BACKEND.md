# Backend wiring — D1 + KV + KIE + R2 upload

本仓库 = Cursor 临摹的 DreamUtopia，不是 pikbo（主站），也不是 OpenCode 的 magicremover-clone。

**Runtime (2026 migration):** Next.js App Router on **Cloudflare Workers** via OpenNext (`npm run cf:deploy`). API handlers live in `src/server/handlers` → `src/app/api/**/route.ts`. Bindings stay D1 / KV / R2 (same IDs in `wrangler.toml`).

**Production today is still Pages** ([dreamutopia-clone.pages.dev](https://dreamutopia-clone.pages.dev)). The Worker is a parallel/staging target until the manual cutover in **DEPLOY.md**. Merging this tree does not flip live traffic.

Cloudflare 资源名：Pages (live) + Worker (Next) `dreamutopia-clone` · D1 `dreamutopia-db` · R2 `dreamutopia-media` · KV `SESSIONS`。

Legacy Pages snapshot: `legacy/out` + `legacy/functions` (see `legacy/README.md`).

Auth, credits, and generation history need Cloudflare bindings. Image-to-video, text-to-video, first+last frame, and stills accept either:

- a file uploaded to R2 (`POST /api/upload` → public `GET /api/media?key=`), JPG/PNG/WebP/GIF/TIFF ≤ 20 MB, or
- any public `https` `imageUrl` that KIE can fetch.

Guests (no session) get **2 Lite image-to-video** tries per device cookie + IP, stored in KV (`du_guest`). Signed-in jobs go to D1.

When a job finishes, the Function copies the provider file into R2 when `MEDIA` is bound, then stores that `/api/media` URL as `result_url`. KIE also POSTs `callBackUrl` to `/api/webhooks/kie` (same settle path as poll — credits refund at most once).

The first commit in this repo is the purchased Cloudflare Pages backend template (TaleTok-style: D1 + KV sessions + Stripe fetch + Resend). This clone keeps that stack and maps it to DreamUtopia one-time credit packs (not subscriptions). Template paths `/api/stripe/checkout` and `/api/stripe/webhook` still work as aliases.

## Payments (optional Stripe)

`GET /api/checkout` returns **503** `{ ok: false, configured: false, packs, … }` until `STRIPE_SECRET_KEY` is set (honest — not a live charge endpoint). After the secret is set it returns **200** `{ ok: true, configured: true, packs, … }`.

`POST /api/checkout` `{ packId }` (signed-in) creates a Stripe Checkout Session (`price_data`, no pre-created Price IDs). If the secret is missing it returns `checkout_not_configured` (503) — the UI does not pretend to charge.

Webhook: `POST /api/webhooks/stripe` (alias `POST /api/stripe/webhook`) with `Stripe-Signature`. On `checkout.session.completed` credits are added (idempotent via `credit_events.stripe_session_id`). First purchase adds **31** bonus credits (5 Lite + 1 Pro). If the buyer has `referred_by`, the referrer gets **10%** of the pack credits. Repeat checkouts reuse `users.stripe_customer_id` when migration `004` is applied.

Stripe Dashboard → Developers → Webhooks → endpoint `https://<host>/api/webhooks/stripe` → event `checkout.session.completed`. Paste the signing secret as Pages secret `STRIPE_WEBHOOK_SECRET`.

## Password reset (optional Resend)

`POST /api/auth/forgot` `{ email }` sends a 1-hour KV token via Resend. If `RESEND_API_KEY` is missing it returns `email_not_configured` (503) and never returns a reset URL to the client. `POST /api/auth/reset` `{ token, password }` sets the new hash. Register also sends a welcome email when Resend is configured (failure does not block signup).

Register/login copies guest KV jobs into D1 history (`mergeGuestJobs`). Register accepts optional `referralCode` (`?ref=` on `/auth`).

## Binding names (must match code)

| Binding / secret | Type | Required for | Used by |
|------------------|------|--------------|---------|
| `DB` | D1 | auth + generate + checkout | users, credits, generations, gallery, credit_events |
| `SESSIONS` | KV | auth + generate + reset | login/register/logout/me session tokens, guest trials, reset tokens, rate limits |
| `KIE_API_KEY` | Workers **secret** | real generate | `/api/generate` → KIE Market API |
| `KIE_WEBHOOK_HMAC_KEY` | Workers **secret** | optional callback auth | `POST /api/webhooks/kie` (`X-Webhook-Signature`) |
| `MEDIA` | R2 | **file upload** | `POST /api/upload`, `GET /api/media` |
| `STRIPE_SECRET_KEY` | Workers **secret** | paid packs | `POST /api/checkout` |
| `STRIPE_WEBHOOK_SECRET` | Workers **secret** | paid packs | `POST /api/webhooks/stripe` |
| `RESEND_API_KEY` | Workers **secret** | password reset email | `POST /api/auth/forgot` |
| `MAIL_FROM` | Workers var/secret | password reset email | verified Resend from-address |

## Generate path

```
POST /api/upload          Authorization: Bearer <session>
  Content-Type: image/jpeg (raw body, ≤20 MB)
→ { key, imageUrl }       // https://<host>/api/media?key=…

POST /api/generate
  Authorization: Bearer <session>   // optional — omit for guest Lite I2V
  {
    "prompt",
    "kind": "video"|"image",
    "imageUrl?",
    "lastImageUrl?",
    "imageUrls?",
    "mediaKey?",
    "model",
    "durationSec?",
    "aspectRatio?",
    "resolution?"
  }

→ guest: Lite I2V only, 2 tries, KV job id `g_…`
→ account: deduct credits (video Lite 3 / Med 5 / Pro 16 · image Lite 1 / Pro 2)
→ KIE createTask (+ callBackUrl `/api/webhooks/kie`):
     video + lastImageUrl → kling-3.0/video (Medium/Pro)
     video + imageUrl     → kling-2.6/image-to-video
     video, no image      → kling-2.6/text-to-video
     image                → nano-banana-2 (1K / 2K / 4K, optional blend)
→ { generationId, kind, status, providerJobId, credits?, guestRemaining? }

GET /api/generate?id=<generationId>
→ poll KIE recordInfo when still processing (same settle as the webhook)
→ copy result into R2 when MEDIA is bound
→ fail refunds credits once (`WHERE status='processing'` + `refund:gen:{id}`)
→ { status, resultUrl, generation.kind, providerState }

POST /api/webhooks/kie
→ KIE callBackUrl; re-fetches recordInfo; optional HMAC if `KIE_WEBHOOK_HMAC_KEY` is set

POST /api/gallery   Authorization: Bearer <session>
  { "generationId" }
→ opt-in publish of a finished account job (needs R2 media_key)
GET /api/gallery
→ { items: [{ id, url, kind, prompt, likes }] }
```

If `KIE_API_KEY` is missing:

```json
{
  "error": "kie_api_key_missing",
  "code": "kie_api_key_missing",
  "message": "KIE_API_KEY is not configured. …",
  "kieConfigured": false,
  "mediaRequired": false
}
```

HTTP **503**. Workspace shows this message (no fake demo).

If `MEDIA` is missing, `POST /api/upload` returns `media_not_bound` (503). Generate still works with a pasted public URL.

## 1. Create resources (CLI)

Requires Cloudflare login or `CLOUDFLARE_API_TOKEN` (+ optional `CLOUDFLARE_ACCOUNT_ID`):

```bash
npx wrangler login
# or: export CLOUDFLARE_API_TOKEN=...

npx wrangler d1 create dreamutopia-db
npx wrangler kv namespace create SESSIONS
npx wrangler r2 bucket create dreamutopia-media
```

Apply schema (new DBs):

```bash
npx wrangler d1 execute dreamutopia-db --remote --file=schema.sql
```

**Existing DBs** also need:

```bash
npx wrangler d1 execute dreamutopia-db --remote --file=migrations/001_generations_kie.sql
npx wrangler d1 execute dreamutopia-db --remote --file=migrations/002_gallery_unique.sql
npx wrangler d1 execute dreamutopia-db --remote --file=migrations/003_referrals_credits.sql
npx wrangler d1 execute dreamutopia-db --remote --file=migrations/004_template_hardening.sql
```

## 2. Paste IDs into `wrangler.toml`

```toml
[[d1_databases]]
binding = "DB"
database_name = "dreamutopia-db"
database_id = "<paste from d1 create>"

[[kv_namespaces]]
binding = "SESSIONS"
id = "<paste from kv namespace create>"

[[r2_buckets]]
binding = "MEDIA"
bucket_name = "dreamutopia-media"
```

## 3. Set `KIE_API_KEY` (Pages secret)

1. Create a key at [kie.ai API keys](https://kie.ai/api-key)
2. Cloudflare Dashboard → **Workers & Pages** → project → **Settings** → **Variables and Secrets**
3. Add secret **`KIE_API_KEY`** (Production; Preview if needed)
4. Redeploy so Functions see the secret

Do **not** commit the key.

## 3b. Optional Stripe + Resend secrets

**Stripe (paid credit packs)**

1. Stripe Dashboard → Developers → API keys → Secret key → Pages secret `STRIPE_SECRET_KEY`
2. Developers → Webhooks → Add endpoint `https://<your-host>/api/webhooks/stripe` → event `checkout.session.completed`
3. Paste the webhook signing secret as Pages secret `STRIPE_WEBHOOK_SECRET`
4. Redeploy. `GET /api/health` → `checkoutConfigured: true`. Pricing CTAs then open Stripe.

Optional: after enabling webhook HMAC on [kie.ai Settings](https://kie.ai/settings), set Pages secret `KIE_WEBHOOK_HMAC_KEY` to the same `webhookHmacKey`. Until then, `/api/webhooks/kie` still settles by re-querying KIE (does not trust the POST body for credits).

**Resend (password reset email)**

1. Create an API key at [resend.com](https://resend.com)
2. Pages secrets: `RESEND_API_KEY` and `MAIL_FROM` (a verified sender, e.g. `DreamUtopia <noreply@yourdomain.com>`)
3. Without these, `POST /api/auth/forgot` returns `email_not_configured` (503) and does **not** leak a reset URL

## 4. Cloudflare Pages dashboard bindings

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → project
2. **Settings** → **Bindings**
3. Add **D1** `DB`, **KV** `SESSIONS`, **R2** `MEDIA`
4. Redeploy

## 5. Deploy runtime (Workers)

After the Next.js migration, APIs run on the **Worker** (`npm run cf:deploy` — see **DEPLOY.md**), not Pages Functions.

```bash
npm run cf:secret:kie
npm run cf:deploy
npm run check:health -- https://<worker-host>
```

Pages dashboard secrets are not used by OpenNext. Re-put secrets with `wrangler secret put` (or Worker → Settings → Variables and Secrets).

## 6. Verify

```bash
curl -s https://<worker-host>/api/health | jq
# legacy Pages URL may still exist until cutover:
# curl -s https://dreamutopia-clone.pages.dev/api/health | jq
```

Expect:

- `runtime: "next-opennext-workers"` (Worker only; live Pages today has no this value)
- `productionSurface: "pages-until-cutover"` and `cutoverComplete: false` until you finish **DEPLOY.md** cutover
- `authReady: true` (D1 + KV bound **and** soft probes OK)
- `guestTrialsReady: true` (KV probe OK — guest cookie/IP trials)
- `kieConfigured: true` (after Workers secret is set)
- `generateReady: true` (`guestTrialsReady` ∧ `kieConfigured`)
- `guestTrials: true`
- `degraded: false` (bound DB/KV must answer probes)
- `uploadReady: true` (MEDIA bound)
- `checkoutConfigured: true` after `STRIPE_SECRET_KEY` is set (otherwise `false`; GET `/api/checkout` is 503 until then)
- `mailConfigured: true` after `RESEND_API_KEY` is set

Then:

```bash
TOKEN=$(curl -s -X POST https://dreamutopia-clone.pages.dev/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"secret1"}' | jq -r .token)

# Upload (or skip and pass any public imageUrl)
# curl -s -X POST https://dreamutopia-clone.pages.dev/api/upload \
#   -H "authorization: Bearer $TOKEN" -H 'content-type: image/png' --data-binary @photo.png | jq

curl -s -X POST https://dreamutopia-clone.pages.dev/api/generate \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{
    "prompt":"gentle camera push-in, soft wind",
    "model":"lite",
    "durationSec":5,
    "imageUrl":"https://static.aiquickdraw.com/tools/example/1764851002741_i0lEiI8I.png"
  }' | jq

curl -s "https://dreamutopia-clone.pages.dev/api/generate?id=<generationId>" \
  -H "authorization: Bearer $TOKEN" | jq
```

Without the secret, the same POST returns `code: "kie_api_key_missing"` (503).

## Behavior matrix

| Situation | Result |
|-----------|--------|
| Missing DB/SESSIONS | `bindings_missing` 503 |
| Auth OK, no `KIE_API_KEY` | `kie_api_key_missing` 503 |
| KIE key set, wallet empty / 402 | `kie_insufficient_balance` 502 (honest — no fake result; site credits refunded) |
| Auth + KIE, no MEDIA | Generate works with public `imageUrl`; upload returns `media_not_bound` |
| Auth + KIE + MEDIA | Upload file **or** paste URL |
| Missing `imageUrl` on **guest** video | `image_url_required` 400 |
| Guest 3rd try | `guest_limit` 402 |
| Guest Medium/Pro/image | `guest_lite_only` 401 |
| Missing `imageUrl` on signed-in video | text-to-video (allowed) |
| First+last on Lite | `first_last_requires_medium` 400 |
| D1 missing new columns | `schema_migration_required` 503 |
| Checkout without Stripe secret | GET `{ configured: false }`; POST `checkout_not_configured` 503 |
| Forgot password without Resend | `email_not_configured` 503 |
| Too many generate/auth requests | `rate_limited` 429 |
| 3+ jobs already processing | `job_in_flight` 429 |

## Checklist

- [ ] `wrangler d1 create` + `kv namespace create` + `r2 bucket create` (or reuse existing IDs in `wrangler.toml`)
- [ ] `npm run db:schema` (+ `npm run db:migrate` if the DB already existed)
- [ ] `wrangler.toml` bindings: `DB`, `SESSIONS`, `MEDIA`
- [ ] Workers secret: `KIE_API_KEY` (`npm run cf:secret:kie`)
- [ ] Optional: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (webhook URL `/api/webhooks/stripe`)
- [ ] Optional: `RESEND_API_KEY` + `MAIL_FROM` (password reset + welcome)
- [ ] Optional: `KIE_WEBHOOK_HMAC_KEY` after enabling HMAC on kie.ai Settings
- [ ] `npm run cf:deploy` (OpenNext Worker — not Pages `out/`)
- [ ] `/api/health` → `generateReady: true`, `uploadReady: true`
- [ ] Logged-in POST `/api/upload` then `/api/generate` queues a KIE job; GET returns `resultUrl`
- [ ] Logged-out POST `/api/generate` with `imageUrl` consumes one of two guest Lite tries
- [ ] Guest **My Creations** lists KV jobs from `GET /api/generate` on this device
