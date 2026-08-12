# Backend wiring — D1 + KV + KIE + R2 upload

Cloudflare 资源名：Pages 项目 `dreamutopia-clone` · D1 `dreamutopia-db` · R2 `dreamutopia-media` · KV `SESSIONS`。原站是 dreamutopia.net，不是 taletok.io。

Auth, credits, and generation history need Cloudflare bindings. Image-to-video, text-to-video, first+last frame, and stills accept either:

- a file uploaded to R2 (`POST /api/upload` → public `GET /api/media?key=`), or
- any public `https` `imageUrl` that KIE can fetch.

Guests (no session) get **2 Lite image-to-video** tries per device cookie + IP, stored in KV (`du_guest`). Signed-in jobs go to D1.

When a job finishes, the Function copies the provider file into R2 when `MEDIA` is bound, then stores that `/api/media` URL as `result_url`.

Payment/Stripe is out of scope. `GET/POST /api/checkout` returns `checkout_not_configured` (503).

## Binding names (must match code)

| Binding / secret | Type | Required for | Used by |
|------------------|------|--------------|---------|
| `DB` | D1 | auth + generate | users, credits, generations, gallery |
| `SESSIONS` | KV | auth + generate | login/register/logout/me session tokens |
| `KIE_API_KEY` | Pages **secret** | real generate | `/api/generate` → KIE Market API |
| `MEDIA` | R2 | **file upload** | `POST /api/upload`, `GET /api/media` |

## Generate path

```
POST /api/upload          Authorization: Bearer <session>
  Content-Type: image/jpeg (raw body, ≤10 MB)
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
→ KIE createTask:
     video + lastImageUrl → kling-3.0/video (Medium/Pro)
     video + imageUrl     → kling-2.6/image-to-video
     video, no image      → kling-2.6/text-to-video
     image                → nano-banana-2 (1K / 2K / 4K, optional blend)
→ { generationId, kind, status, providerJobId, credits?, guestRemaining? }

GET /api/generate?id=<generationId>
→ poll KIE recordInfo when still processing
→ copy result into R2 when MEDIA is bound
→ { status, resultUrl, generation.kind }
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

**Existing DBs** (created before KIE columns) also need:

```bash
npx wrangler d1 execute dreamutopia-db --remote --file=migrations/001_generations_kie.sql
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

## 4. Cloudflare Pages dashboard bindings

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → project
2. **Settings** → **Bindings**
3. Add **D1** `DB`, **KV** `SESSIONS`, **R2** `MEDIA`
4. Redeploy

## 5. Verify

```bash
curl -s https://dreamutopia-clone.pages.dev/api/health | jq
```

Expect:

- `authReady: true`
- `kieConfigured: true` (after secret is set)
- `generateReady: true`
- `guestTrials: true`
- `uploadReady: true` (MEDIA bound)
- `checkoutConfigured: false`

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
| Auth + KIE, no MEDIA | Generate works with public `imageUrl`; upload returns `media_not_bound` |
| Auth + KIE + MEDIA | Upload file **or** paste URL |
| Missing `imageUrl` on **guest** video | `image_url_required` 400 |
| Guest 3rd try | `guest_limit` 402 |
| Guest Medium/Pro/image | `guest_lite_only` 401 |
| Missing `imageUrl` on signed-in video | text-to-video (allowed) |
| First+last on Lite | `first_last_requires_medium` 400 |
| D1 missing new columns | `schema_migration_required` 503 |
| Checkout | `checkout_not_configured` 503 |

## Checklist

- [ ] `wrangler d1 create` + `kv namespace create` + `r2 bucket create`
- [ ] `schema.sql` (+ `migrations/001_generations_kie.sql` if DB already existed)
- [ ] Pages bindings: `DB`, `SESSIONS`, `MEDIA`
- [ ] Pages secret: `KIE_API_KEY`
- [ ] Redeploy
- [ ] `/api/health` → `generateReady: true`, `uploadReady: true`
- [ ] Logged-in POST `/api/upload` then `/api/generate` queues a KIE job; GET returns `resultUrl`
- [ ] Logged-out POST `/api/generate` with `imageUrl` consumes one of two guest Lite tries
