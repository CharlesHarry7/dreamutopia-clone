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
| https://dreamutopia-clone.pages.dev | **生产**（`main`，PR #12 已合并） |
| https://cursor-overnight-prod-polish.dreamutopia-clone.pages.dev | **PR #13 预览**（空 KIE 钱包诚实 503、产品打磨） |
| [PR #13](https://github.com/CharlesHarry7/dreamutopia-clone/pull/13) | **打开中，勿合并** — Pages 生产路径打磨；checkout 仍诚实 503 |
| [PR #14](https://github.com/CharlesHarry7/dreamutopia-clone/pull/14) | **另开分支实验** — Next.js + Tailwind + shadcn + OpenNext Workers。**不要**并进 PR #13 / 不要改本分支 `wrangler.toml` 为 `main = ".open-next/worker.js"` |
| [PR #12](https://github.com/CharlesHarry7/dreamutopia-clone/pull/12) | **已合并** — 游客试用 / Stripe 接线 / KIE 回调 |
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
| Payments | Stripe Checkout (`STRIPE_SECRET_KEY` + webhook) — optional |
| Auth | Session token + KV + PBKDF2 (Web Crypto); optional Resend reset |

## Project Structure

```
/out               # Static pages (build output dir)
  index.html       # Homepage (2 free Lite I2V on-page)
  pricing.html     # Pricing (Stripe when configured; otherwise honest no-charge CTAs)
  workspace.html   # Generation workspace + invite link
  auth.html        # Login / register / forgot password
  reset.html       # Password reset from email token
  image-to-video.html / photo-to-video.html / free-ai-video.html
  privacy.html     # Privacy
  terms.html       # Terms
  assets/js/du.js  # Shared fetch / upload / poll / download
  assets/js/i18n.js # EN / 中文 / 日本語 / Español
  assets/js/nav.js  # Mobile header drawer
  assets/js/pwa.js  # Service worker + install banner
  assets/js/seo.js  # Canonical + Open Graph
  assets/css/chrome.css  # Body wash + hamburger (Pages; not Next)
  manifest.webmanifest
  sw.js
/functions          # Pages Functions
  robots.txt.ts    # GET /robots.txt
  sitemap.xml.ts   # GET /sitemap.xml
/functions/api     # API routes
  health.ts        # GET /api/health
  auth/            # register / login / logout / me / forgot / reset
  credits.ts       # GET /api/credits (account or guest remaining)
  upload.ts        # GET probe + POST file → R2 (auth or guest)
  media.ts         # GET/HEAD /api/media?key= (public image bytes)
  generate.ts      # POST/GET /api/generate (KIE)
  gallery.ts       # GET public gallery + POST opt-in publish
  gallery/like.ts  # POST like (IP-deduped)
  checkout.ts      # GET catalog + POST Stripe session
  stripe/          # template aliases → checkout + stripe webhook
  webhooks/stripe.ts
  webhooks/kie.ts  # KIE callBackUrl (re-verify + idempotent refund)
  upload-ticket.ts # Legacy probe
/libs              # Shared backend logic
/scripts           # node scripts/check.mjs — i18n parity, packs, checkout honesty
/schema.sql        # D1 database schema
/migrations        # D1 ALTER scripts for existing DBs
/wrangler.toml     # Cloudflare configuration
```

## Generate path

1. **Guest:** homepage or `/workspace` — 2 Lite image-to-video tries per device/IP, no account. Jobs live in KV, not D1.
2. **Account:** sign up (10 credits). Video: text-to-video, image-to-video, or first+last frame (Medium/Pro). Image: T2I / I2I / blend, 1K–4K.
3. `POST /api/generate` creates a KIE task (`kling-2.6/image-to-video`, `kling-2.6/text-to-video`, `kling-3.0/video`, or `nano-banana-2`).
4. Client polls `GET /api/generate?id=…` until `status=done` (UI shows provider state: queue → render). When R2 is bound, the provider file is copied to `/api/media`.
5. Signed-in users can **Download** a result or **Share to gallery** (opt-in). Homepage loads live gallery items when any exist; public items can be liked (once per IP).
6. Language selector switches EN / 中文 / 日本語 / Español (including keyword landings). PWA: add to home screen (`manifest.webmanifest` + `sw.js` + `/offline`). Generate polling shows elapsed time, retries blips, and can stop waiting without killing the job. Phone-width headers use a hamburger drawer (`chrome.css` + `nav.js`) instead of hiding nav.
7. Paid packs: without Stripe secrets, `GET/POST /api/checkout` is **503** (`configured: false`) — no fake charge. With secrets, signed-in POST redirects to Stripe. First purchase +31 credits; invites earn 10% of the pack. Password reset needs Resend. `/robots.txt` and `/sitemap.xml` are Functions.

`node scripts/check.mjs` (also GitHub Action `check`) asserts i18n key parity, pack ids vs pricing, checkout honesty, and that the service worker never caches `/api`.

## Backend setup

See **[BACKEND.md](./BACKEND.md)** for bindings, Pages secrets (`KIE_API_KEY`, optional Stripe + Resend + KIE webhook HMAC), and D1 migrations `001`–`004`.

**Required for live generate:** `SESSIONS` + `KIE_API_KEY` (guest trials) **and a funded KIE wallet**. Signed-in generate also needs `DB`.  
If the key is set but KIE’s own balance is empty, generate returns `provider_credits_insufficient` (503) — that is not the user’s credit pack.  
**Required for file upload:** `MEDIA` / R2. Public `imageUrl` still works without R2.

## Deploy

1. Follow BACKEND.md (D1/KV/R2 + schema/migration + `KIE_API_KEY` secret)
2. Bind `DB` / `SESSIONS` / `MEDIA` in Pages Settings
3. Connect repo to Cloudflare Pages (build command: none, output dir: `out`) or `wrangler pages deploy out`

`out/_routes.json` sends `/api/*` to Pages Functions so unknown API paths return Function responses instead of the homepage.

**Do not merge PR #14 into this Pages product** without Daniel. PR #14 rewrites `wrangler.toml` to OpenNext Workers (`main = ".open-next/worker.js"`) and would break the live Pages git deploy (`pages_build_output_dir = "out"`). Useful UI ideas (mobile nav, body wash) are ported here in `out/assets/css/chrome.css` without taking that deploy path.

## Cost

| Item | Monthly Cost |
|---|---|
| Cloudflare Pages | $0 (free tier) |
| Cloudflare D1 | $0 (5GB free) |
| Cloudflare KV | $0 (1GB free) |
| Cloudflare R2 | $0 (10 GB storage / 1M Class A on free) |
| KIE API | usage-based (your KIE account) |
