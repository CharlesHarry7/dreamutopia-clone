# DreamUtopia Clone — Cloudflare Full Stack

1:1 clone of **[dreamutopia.net](https://dreamutopia.net)** (AI image-to-video). Not taletok.io, not magicremover.

## 名字对照（避免搞混）

| 你看到的 | 实际是什么 | 不是什么 |
|---|---|---|
| **dreamutopia.net** | 原站，抄的对象 | 不是我们的仓库/域名 |
| **dreamutopia-clone** | GitHub 仓库名 + Cloudflare Pages 项目名 | 不是原站 |
| **https://github.com/CharlesHarry7/dreamutopia-clone** | 代码仓库 | GitHub 简介里若还写 `taletok.io`，那是旧文案，忽略 |
| **https://dreamutopia-clone.pages.dev** | **生产站**（`main` 分支） | 不是预览 |
| **https://cursor-r2-upload-product-pol.dreamutopia-clone.pages.dev** | **PR #12 预览**（当前开发分支） | 不是生产 |
| **PR [#12](https://github.com/CharlesHarry7/dreamutopia-clone/pull/12)** | 游客 2 次试用 / 文生视频 / 首尾帧，待合并 | 合进 `main` 后生产才会更新 |
| **dreamutopia-db** | D1 数据库 | — |
| **dreamutopia-media** | R2 图片/视频桶 | — |
| **SESSIONS** | KV：登录 session + 游客试用次数 | — |
| **KIE_API_KEY** | 出图/出视频的密钥（生产有，预览没有） | — |
| **magicremover-clone / pikbo / plaindoc / laoma-price-watch** | 你账号下的**别的仓库** | 和本站无关 |

仓库曾从 `taletok-clone` 改名为 `dreamutopia-clone`。代码里一律用 DreamUtopia。

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Pure HTML + CSS + vanilla JS (no build step) |
| Hosting | Cloudflare Pages (unlimited bandwidth, free) |
| API | Cloudflare Pages Functions |
| Database | Cloudflare D1 (SQLite at the edge) |
| Sessions | Cloudflare KV (login sessions + guest trial counters) |
| Inference | [KIE](https://kie.ai) Market API (`KIE_API_KEY` secret) |
| File Storage | Cloudflare R2 (`MEDIA`) for start-image uploads |
| Auth | Session token + KV + PBKDF2 (Web Crypto) |

## Project Structure

```
/out               # Static pages (build output dir)
  index.html       # Homepage (2 free Lite I2V on-page)
  pricing.html     # Pricing (checkout not live — honest CTAs)
  workspace.html   # Generation workspace
  auth.html        # Login / register
  privacy.html     # Privacy
  terms.html       # Terms
  assets/js/du.js  # Shared fetch / upload / poll helper
/functions/api     # Cloudflare Pages Functions (API routes)
  health.ts        # GET /api/health
  auth/            # register / login / logout / me
  credits.ts       # GET /api/credits (account or guest remaining)
  upload.ts        # GET probe + POST file → R2 (auth or guest)
  media.ts         # GET/HEAD /api/media?key= (public image bytes)
  generate.ts      # POST/GET /api/generate (KIE)
  gallery.ts       # GET /api/gallery
  checkout.ts      # GET/POST stub (503 checkout_not_configured)
  upload-ticket.ts # Legacy probe
/libs              # Shared backend logic
/schema.sql        # D1 database schema
/migrations        # D1 ALTER scripts for existing DBs
/wrangler.toml     # Cloudflare configuration
```

## Generate path

1. **Guest:** homepage or `/workspace` — 2 Lite image-to-video tries per device/IP, no account. Jobs live in KV, not D1.
2. **Account:** sign up (10 credits). Video: text-to-video, image-to-video, or first+last frame (Medium/Pro). Image: T2I / I2I / blend, 1K–4K.
3. `POST /api/generate` creates a KIE task (`kling-2.6/image-to-video`, `kling-2.6/text-to-video`, `kling-3.0/video`, or `nano-banana-2`).
4. Client polls `GET /api/generate?id=…` until `status=done`. When R2 is bound, the provider file is copied to `/api/media`.
5. Paid checkout is **not live**.

## Backend setup

See **[BACKEND.md](./BACKEND.md)** for bindings, the `KIE_API_KEY` Pages secret, and D1 migration `001_generations_kie.sql`.

**Required for live generate:** `SESSIONS` + `KIE_API_KEY` (guest trials). Signed-in generate also needs `DB`.  
**Required for file upload:** `MEDIA` / R2. Public `imageUrl` still works without R2.

## Deploy

1. Follow BACKEND.md (D1/KV/R2 + schema/migration + `KIE_API_KEY` secret)
2. Bind `DB` / `SESSIONS` / `MEDIA` in Pages Settings
3. Connect repo to Cloudflare Pages (build command: none, output dir: `out`) or `wrangler pages deploy out`

`out/_routes.json` sends `/api/*` to Pages Functions so unknown API paths return Function responses instead of the homepage.

## Cost

| Item | Monthly Cost |
|---|---|
| Cloudflare Pages | $0 (free tier) |
| Cloudflare D1 | $0 (5GB free) |
| Cloudflare KV | $0 (1GB free) |
| Cloudflare R2 | $0 (10 GB storage / 1M Class A on free) |
| KIE API | usage-based (your KIE account) |
