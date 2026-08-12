# Backend wiring — D1 + KV + KIE (R2 optional)

Auth, credits, and generation history need Cloudflare bindings. **Image-to-video does not require R2/MEDIA** right now: the client sends a public `imageUrl`, the Function calls KIE, D1 stores job status, and the client receives the provider `resultUrl`.

Payment/Stripe is out of scope.

## Binding names (must match code)

| Binding / secret | Type | Required for | Used by |
|------------------|------|--------------|---------|
| `DB` | D1 | auth + generate | users, credits, generations, gallery |
| `SESSIONS` | KV | auth + generate | login/register/logout/me session tokens |
| `KIE_API_KEY` | Pages **secret** | real generate | `/api/generate` → KIE Market API |
| `MEDIA` | R2 | **optional** | future upload path (`/api/upload-ticket` status only) |

## Temporary generate path (no R2)

```
POST /api/generate
  Authorization: Bearer <session>
  { "prompt", "imageUrl": "https://…", "model", "durationSec" }

→ deduct credits
→ KIE createTask (kling-2.6/image-to-video)
→ INSERT generations (status=processing, provider_job_id, input_image_url)
→ { generationId, status, providerJobId, credits }

GET /api/generate?id=<generationId>
→ poll KIE recordInfo when still processing
→ update D1 to done/failed
→ { status, resultUrl }   // provider video URL, not an R2 key
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

HTTP **503**. No homepage demo alert — workspace shows this message.

## 1. Create resources (CLI)

Requires Cloudflare login or `CLOUDFLARE_API_TOKEN` (+ optional `CLOUDFLARE_ACCOUNT_ID`):

```bash
npx wrangler login
# or: export CLOUDFLARE_API_TOKEN=...

npx wrangler d1 create dreamutopia-db
npx wrangler kv namespace create SESSIONS
# Optional later:
# npx wrangler r2 bucket create dreamutopia-media
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

# Optional — generate works without this:
# [[r2_buckets]]
# binding = "MEDIA"
# bucket_name = "dreamutopia-media"
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
3. Add **D1** `DB` and **KV** `SESSIONS`
4. `MEDIA` / R2 is optional for this path
5. Redeploy

## 5. Verify

```bash
curl -s https://dreamutopia-clone.pages.dev/api/health | jq
```

Expect:

- `authReady: true`
- `kieConfigured: true` (after secret is set)
- `generateReady: true`
- `mediaRequiredForGenerate: false`
- `bindings.MEDIA` may still be `false` — that is OK

Then:

```bash
# Register → 10 credits
TOKEN=$(curl -s -X POST https://dreamutopia-clone.pages.dev/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"secret1"}' | jq -r .token)

# Generate (public image URL — no R2)
curl -s -X POST https://dreamutopia-clone.pages.dev/api/generate \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{
    "prompt":"gentle camera push-in, soft wind",
    "model":"lite",
    "durationSec":5,
    "imageUrl":"https://static.aiquickdraw.com/tools/example/1764851002741_i0lEiI8I.png"
  }' | jq

# Poll until done
curl -s "https://dreamutopia-clone.pages.dev/api/generate?id=<generationId>" \
  -H "authorization: Bearer $TOKEN" | jq
```

Without the secret, the same POST returns `code: "kie_api_key_missing"` (503).

## Behavior matrix

| Situation | `/api/generate` |
|-----------|-----------------|
| Missing DB/SESSIONS | `bindings_missing` 503 |
| Auth OK, no `KIE_API_KEY` | `kie_api_key_missing` 503 |
| Auth + KIE, no MEDIA | **Works** with public `imageUrl` |
| Missing `imageUrl` | `image_url_required` 400 |
| D1 missing new columns | `schema_migration_required` 503 |

## Checklist

- [ ] `wrangler d1 create` + `kv namespace create`
- [ ] `schema.sql` (+ `migrations/001_generations_kie.sql` if DB already existed)
- [ ] Pages bindings: `DB`, `SESSIONS`
- [ ] Pages secret: `KIE_API_KEY`
- [ ] Redeploy
- [ ] `/api/health` → `generateReady: true`
- [ ] Logged-in POST with public `imageUrl` queues a KIE job; GET returns `resultUrl`
- [ ] (Later) bind `MEDIA` and switch uploads to R2 without changing the KIE client
