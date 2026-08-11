# Backend wiring — D1 + KV + R2

Auth, credits, and generation history need Cloudflare bindings. **This repo is code-ready**; production still needs a human (or an agent with `CLOUDFLARE_API_TOKEN`) to create resources and attach them to the Pages project.

Payment/Stripe and real AI inference are out of scope.

## Binding names (must match code)

| Binding | Type | Used by |
|--------|------|---------|
| `DB` | D1 | users, credits, generations, gallery |
| `SESSIONS` | KV | login/register/logout/me session tokens |
| `MEDIA` | R2 | future media storage (upload-ticket reports status) |

## 1. Create resources (CLI)

Requires Cloudflare login or `CLOUDFLARE_API_TOKEN` (+ optional `CLOUDFLARE_ACCOUNT_ID`):

```bash
npx wrangler login
# or: export CLOUDFLARE_API_TOKEN=...

npx wrangler d1 create dreamutopia-db
npx wrangler kv namespace create SESSIONS
npx wrangler r2 bucket create dreamutopia-media
```

Each create command prints an **id**. Copy them.

Apply schema to the **remote** D1 database:

```bash
npx wrangler d1 execute dreamutopia-db --remote --file=schema.sql
```

## 2. Paste IDs into `wrangler.toml`

Uncomment the binding blocks and replace placeholders:

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

> **Do not commit fake `REPLACE_ME` IDs uncommented** — invalid IDs break Cloudflare Pages deploys. Keep bindings commented until real IDs exist (current default).

## 3. Cloudflare Pages dashboard bindings (required for production)

`wrangler.toml` bindings apply to Wrangler/local deploys. **Pages projects often need bindings set in the dashboard as well:**

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → project `dreamutopia-clone` (or your project name)
2. **Settings** → **Bindings**
3. Add:
   - **D1 database** → variable name `DB` → `dreamutopia-db`
   - **KV namespace** → variable name `SESSIONS` → the `SESSIONS` namespace
   - **R2 bucket** → variable name `MEDIA` → `dreamutopia-media`
4. Apply to **Production** (and Preview if you use preview deploys)
5. **Redeploy** the latest deployment so Functions pick up bindings

## 4. Verify

```bash
curl -s https://dreamutopia-clone.pages.dev/api/health | jq
```

Expect `authReady: true` and `bindings.DB` / `bindings.SESSIONS` true.

Then:

```bash
# Register → 10 credits
curl -s -X POST https://dreamutopia-clone.pages.dev/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"secret1"}' | jq

# Me
curl -s https://dreamutopia-clone.pages.dev/api/auth/me \
  -H "authorization: Bearer <token>" | jq

# Credits
curl -s https://dreamutopia-clone.pages.dev/api/credits \
  -H "authorization: Bearer <token>" | jq

# Generate (deducts lite=3)
curl -s -X POST https://dreamutopia-clone.pages.dev/api/generate \
  -H 'content-type: application/json' \
  -H "authorization: Bearer <token>" \
  -d '{"prompt":"a cat walking","model":"lite"}' | jq
```

## Behavior without bindings

| Endpoint | Without DB/KV |
|----------|----------------|
| `GET /api/health` | `ok: true`, `authReady: false` |
| `POST /api/auth/*`, `GET /api/credits` | `503` with clear message |
| `POST /api/generate` | Demo JSON (`demo: true`), **no credit deduct** |
| `GET /api/gallery` | Empty list (`demo: true`) |

## Checklist

- [ ] `wrangler d1 create dreamutopia-db`
- [ ] `wrangler kv namespace create SESSIONS`
- [ ] `wrangler r2 bucket create dreamutopia-media`
- [ ] `wrangler d1 execute dreamutopia-db --remote --file=schema.sql`
- [ ] Uncomment + paste real IDs in `wrangler.toml` (or rely on dashboard only)
- [ ] Pages → Settings → Bindings: `DB`, `SESSIONS`, `MEDIA`
- [ ] Redeploy Pages
- [ ] `/api/health` shows `authReady: true`
- [ ] Register returns `credits: 10`; generate deducts and returns remaining `credits`
