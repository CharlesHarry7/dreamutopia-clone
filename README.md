# DreamUtopia Clone — Cursor 临摹站（不是 pikbo）

这是 **Cursor 做的** [dreamutopia.net](https://dreamutopia.net) 1:1 临摹。  
**不是** 主站 pikbo，**也不是** OpenCode 做的 Magic Remover。

## 你同时在做的三个网站

| # | 谁做的 | 仓库 | 抄谁 / 产品 | 线上 |
|---|---|---|---|---|
| 1 主站 | 你自己 | [**pikbo**](https://github.com/CharlesHarry7/pikbo) | 原创：潮玩私密 AI 视频 | [pikbo.ai](https://pikbo.ai) |
| 2 本仓库 | **Cursor** | [**dreamutopia-clone**](https://github.com/CharlesHarry7/dreamutopia-clone) | 临摹 dreamutopia.net（图生视频） | [dreamutopia-clone.pages.dev](https://dreamutopia-clone.pages.dev) |
| 3 另一个临摹 | **OpenCode** | [**magicremover-clone**](https://github.com/CharlesHarry7/magicremover-clone) | 临摹 magicremover.org（AI 去物体） | 看该仓库 README / 部署 |

记法：`pikbo` = 正业 · `dreamutopia-clone` = Cursor 抄 DreamUtopia · `magicremover-clone` = OpenCode 抄 Magic Remover。

GitHub 简介若还写 `taletok.io`，是旧文案，忽略。仓库曾从 `taletok-clone` 改名而来。

## 本仓库内部名字（DreamUtopia 这一站）

| 名字 | 是什么 |
|---|---|
| dreamutopia.net | 原站（抄的对象，不是我们的） |
| dreamutopia-clone | GitHub 仓库 + Cloudflare Pages 项目 |
| https://dreamutopia-clone.pages.dev | **生产**（`main`，合 PR 前仍是旧版） |
| https://cursor-r2-upload-product-pol.dreamutopia-clone.pages.dev | **PR #12 预览**（最新功能） |
| [PR #12](https://github.com/CharlesHarry7/dreamutopia-clone/pull/12) | 游客试用 / 文生视频 / 首尾帧，待合并 |
| dreamutopia-db | D1 数据库 |
| dreamutopia-media | R2 媒体桶 |
| SESSIONS | KV（登录 + 游客次数） |
| KIE_API_KEY | 出图/出视频密钥（生产有，预览没有） |

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
  assets/js/du.js  # Shared fetch / upload / poll / download
  assets/js/i18n.js # EN / 中文 / 日本語 / Español
  assets/js/pwa.js  # Service worker + install banner
  manifest.webmanifest
  sw.js
/functions/api     # Cloudflare Pages Functions (API routes)
  health.ts        # GET /api/health
  auth/            # register / login / logout / me
  credits.ts       # GET /api/credits (account or guest remaining)
  upload.ts        # GET probe + POST file → R2 (auth or guest)
  media.ts         # GET/HEAD /api/media?key= (public image bytes)
  generate.ts      # POST/GET /api/generate (KIE)
  gallery.ts       # GET public gallery + POST opt-in publish
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
4. Client polls `GET /api/generate?id=…` until `status=done` (UI shows provider state: queue → render). When R2 is bound, the provider file is copied to `/api/media`.
5. Signed-in users can **Download** a result or **Share to gallery** (opt-in). Homepage loads live gallery items when any exist.
6. Language selector switches EN / 中文 / 日本語 / Español. PWA: add to home screen (`manifest.webmanifest` + `sw.js`).
7. Paid checkout is **not live**.

## Backend setup

See **[BACKEND.md](./BACKEND.md)** for bindings, the `KIE_API_KEY` Pages secret, and D1 migrations `001_generations_kie.sql` / `002_gallery_unique.sql`.

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
