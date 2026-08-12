# Legacy Cloudflare Pages snapshot

This folder is the **pre-Next.js** site that still matches what production Pages serves today:

- `out/` — static HTML/CSS/JS (Pages build output dir)
- `functions/` — Pages Functions (`/api/*`)

Live: [https://dreamutopia-clone.pages.dev](https://dreamutopia-clone.pages.dev)

The Next.js + OpenNext Worker lives at the repo root (`src/`, `wrangler.toml`, **DEPLOY.md**). Deploying the Worker does not turn off Pages.

Until cutover:

1. Keep Pages git deploy on a revision that still has a top-level `out/` **or** point Pages at this snapshot intentionally.
2. Do not assume merging the Next.js branch into `main` is safe for Pages (root `out/` was moved here).
3. When ready, follow the manual checklist in **../DEPLOY.md**, then retire Pages.

API behavior notes that still apply after cutover: guest trials, honest checkout 503, and honest KIE failures (`kie_api_key_missing` / `kie_insufficient_balance`) are preserved in `src/server/`.
