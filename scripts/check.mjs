#!/usr/bin/env node
/**
 * Static product checks — no network, no secrets.
 * Run: node scripts/check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fail = [];
const ok = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function mustContain(rel, needle, label) {
  const src = read(rel);
  if (!src.includes(needle)) fail.push(`${label || rel}: missing ${JSON.stringify(needle)}`);
  else ok.push(`${label || rel}: has ${JSON.stringify(needle)}`);
}

function extractI18nKeys(src) {
  const langs = { en: new Set(), zh: new Set(), ja: new Set(), es: new Set() };
  let current = null;
  let depth = 0;
  for (const line of src.split("\n")) {
    const open = line.match(/^\s*(en|zh|ja|es):\s*\{/);
    if (open) {
      current = open[1];
      depth = 1;
      continue;
    }
    if (!current) continue;
    depth += (line.match(/\{/g) || []).length;
    depth -= (line.match(/\}/g) || []).length;
    const key = line.match(/^\s*"([^"]+)":/);
    if (key) langs[current].add(key[1]);
    if (depth <= 0) current = null;
  }
  return langs;
}

// --- i18n parity ---
{
  const langs = extractI18nKeys(read("out/assets/js/i18n.js"));
  const en = [...langs.en].sort();
  if (en.length < 80) fail.push(`i18n: expected 80+ EN keys, got ${en.length}`);
  else ok.push(`i18n: ${en.length} EN keys`);
  for (const lang of ["zh", "ja", "es"]) {
    const missing = en.filter((k) => !langs[lang].has(k));
    const extra = [...langs[lang]].filter((k) => !langs.en.has(k));
    if (missing.length) fail.push(`i18n ${lang} missing: ${missing.join(", ")}`);
    else ok.push(`i18n ${lang} matches EN (${langs[lang].size} keys)`);
    if (extra.length) fail.push(`i18n ${lang} extra: ${extra.join(", ")}`);
  }
  for (const key of [
    "err.provider_credits_insufficient",
    "err.kie_api_key_missing",
    "auth.forgot",
    "gallery.like",
    "guest.left.none",
    "offline.h",
    "a11y.menu",
    "notfound.h",
  ]) {
    if (!langs.en.has(key)) fail.push(`i18n EN missing required key ${key}`);
  }
}

// --- packs vs pricing ---
{
  const packs = read("libs/packs.ts");
  const pricing = read("out/pricing.html");
  const auth = read("out/auth.html");
  for (const id of ["starter", "plus", "pro", "premium"]) {
    if (!packs.includes(`${id}:`)) fail.push(`packs.ts missing ${id}`);
    if (!pricing.includes(`data-pack="${id}"`)) fail.push(`pricing.html missing data-pack=${id}`);
    if (!auth.includes(`${id}:`)) fail.push(`auth.html PACKS missing ${id}`);
  }
  mustContain("libs/packs.ts", "usdCents: 500", "starter $5");
  mustContain("libs/packs.ts", "credits: 10", "starter 10 credits");
  mustContain("libs/packs.ts", "FIRST_PURCHASE_BONUS_CREDITS", "first-purchase bonus");
  ok.push("packs vs pricing ids aligned");
}

// --- checkout stays honest 503 ---
{
  const checkout = read("functions/api/checkout.ts");
  if (!checkout.includes("checkout_not_configured")) fail.push("checkout.ts missing checkout_not_configured");
  if (!checkout.includes("503")) fail.push("checkout.ts missing 503");
  if (!checkout.includes("hasStripe")) fail.push("checkout.ts missing hasStripe gate");
  if (!checkout.includes("onRequestHead")) fail.push("checkout.ts missing HEAD (honest 503)");
  mustContain("functions/api/stripe/checkout.ts", "onRequestHead", "stripe checkout alias HEAD");
  if (/sk_live_|sk_test_[a-zA-Z0-9]{10,}/.test(checkout)) fail.push("checkout.ts looks like it embeds a Stripe secret");
  const pricing = read("out/pricing.html");
  if (!pricing.includes("data.configured === true") && !pricing.includes("data.ok === true && data.configured === true")) {
    fail.push("pricing.html must require data.configured === true, not res.ok");
  } else ok.push("pricing.html requires configured === true");
  const ws = read("out/workspace.html");
  if (!ws.includes("data.configured === true")) fail.push("workspace.html must require data.configured === true");
  else ok.push("workspace.html requires configured === true");
  ok.push("checkout honesty checks");
}

// --- generate provider mapping ---
{
  mustContain("functions/api/generate.ts", "provider_credits_insufficient", "empty KIE wallet");
  mustContain("functions/api/generate.ts", "kie_unauthorized", "bad KIE key");
  mustContain("functions/api/generate.ts", "guestRemaining", "guest remaining on generate");
  mustContain("functions/api/generate.ts", "GUEST_LIMIT", "guest limit");
  mustContain("functions/api/generate.ts", "onRequestHead", "generate HEAD");
  mustContain("functions/api/generate.ts", "Must not poll KIE", "HEAD does not poll KIE");
}

// --- upload guest remaining ---
{
  mustContain("functions/api/upload.ts", "guestRemaining", "upload returns guest remaining");
  mustContain("functions/api/upload.ts", "GUEST_UPLOAD_LIMIT", "guest upload cap");
}

// --- gallery like ---
{
  if (!exists("functions/api/gallery/like.ts")) fail.push("missing functions/api/gallery/like.ts");
  else {
    mustContain("functions/api/gallery/like.ts", "likes + 1", "like increment");
    mustContain("functions/api/gallery/like.ts", "gallery:like:", "like dedupe KV");
  }
  mustContain("out/index.html", "gallery-like", "homepage like UI");
  mustContain("out/assets/js/du.js", "likeGallery", "DU.likeGallery");
}

// --- routes / PWA / keyword i18n ---
{
  const routes = JSON.parse(read("out/_routes.json"));
  if (!Array.isArray(routes.include) || !routes.include.includes("/api/*")) {
    fail.push("_routes.json must include /api/*");
  } else ok.push("_routes.json includes /api/*");
  mustContain("out/sw.js", 'url.pathname.startsWith("/api/")', "SW never caches /api");
  mustContain("out/sw.js", "du-static-v9", "SW cache bump");
  mustContain("out/sw.js", "SKIP_WAITING", "SW skipWaiting message");
  mustContain("out/assets/js/pwa.js", 'updateViaCache: "none"', "PWA updateViaCache none");
  mustContain("out/index.html", 'href="#main"', "homepage skip link");
  mustContain("out/index.html", "prefers-reduced-motion", "reduced motion");
  mustContain("out/index.html", 'aria-live="polite"', "live generate status");
  mustContain("out/index.html", "nav-toggle", "homepage hamburger");
  mustContain("out/workspace.html", "nav-toggle", "workspace hamburger");
  mustContain("out/pricing.html", "nav-toggle", "pricing hamburger");
  mustContain("out/assets/css/chrome.css", "nav-toggle", "shared mobile nav");
  mustContain("out/assets/js/nav.js", "nav-open", "nav drawer toggle");
  mustContain("out/_headers", "X-Content-Type-Options", "nosniff header");
  mustContain("wrangler.toml", 'pages_build_output_dir = "out"', "Pages output dir");
  if (/^\s*main\s*=\s*"\.open-next\/worker\.js"/m.test(read("wrangler.toml"))) {
    fail.push("wrangler.toml must stay Cloudflare Pages (not OpenNext worker main from PR #14)");
  } else ok.push("wrangler.toml stays Pages (not OpenNext)");
  mustContain("out/assets/js/du.js", "shouldRetryPoll", "poll retries transient errors");
  mustContain("out/assets/js/du.js", "poll_cancelled", "poll cancel");
  mustContain("out/assets/js/seo.js", "og:locale", "SEO locale");
  mustContain("out/assets/js/seo.js", "application/ld+json", "JSON-LD");
  mustContain("out/assets/js/seo.js", '"@type": "WebPage"', "interior JSON-LD WebPage");
  mustContain("functions/robots.txt.ts", "Disallow: /reset", "robots hide reset tokens");
  if (!exists("out/404.html")) fail.push("missing out/404.html");
  else {
    mustContain("out/404.html", "notfound.h", "Pages 404 copy");
    mustContain("out/404.html", 'name="robots" content="noindex"', "404 noindex");
  }
  mustContain("functions/api/auth/forgot.ts", "onRequestGet", "forgot GET probe");
  mustContain("functions/api/auth/forgot.ts", "configured: false", "forgot GET honest unconfigured");
  mustContain("out/auth.html", 'method: "GET"', "auth probes forgot GET");
  mustContain("out/auth.html", 'isForgot ? "login"', "forgot switch goes to login");
  mustContain("functions/sitemap.xml.ts", "lastmod", "sitemap lastmod");
  mustContain("libs/kie.ts", "publicProviderFailMessage", "sanitize provider fail copy");
  mustContain("out/sw.js", '"/offline"', "SW precaches pretty /offline");
  if (/PRECACHE[\s\S]*?\.html/.test(read("out/sw.js"))) {
    fail.push("SW PRECACHE must use pretty URLs (/offline not /offline.html) — Pages 308s .html");
  } else ok.push("SW PRECACHE uses pretty URLs");
  mustContain("out/manifest.webmanifest", '"id": "/"', "PWA id");
  mustContain("out/manifest.webmanifest", '"lang": "en"', "PWA lang");
  if (!exists("out/offline.html")) fail.push("missing out/offline.html");
  for (const page of ["out/image-to-video.html", "out/photo-to-video.html", "out/free-ai-video.html"]) {
    mustContain(page, "/assets/js/i18n.js", `${page} i18n`);
    mustContain(page, "lang-select", `${page} lang switcher`);
    mustContain(page, 'href="#main"', `${page} skip link`);
  }
  mustContain("out/privacy.html", "lang-select", "privacy lang switcher");
  mustContain("out/terms.html", "lang-select", "terms lang switcher");
  mustContain("out/auth.html", "credentials: \"same-origin\"", "auth fetch sends guest cookie");
}

// --- no fake stripe / leaked secrets in static ---
{
  const scan = [
    "out/index.html",
    "out/workspace.html",
    "out/pricing.html",
    "out/assets/js/du.js",
    "functions/api/checkout.ts",
    "libs/stripe.ts",
  ];
  for (const rel of scan) {
    const src = read(rel);
    if (/sk_live_[0-9a-zA-Z]{8,}/.test(src) || /sk_test_[0-9a-zA-Z]{20,}/.test(src)) {
      fail.push(`${rel} appears to contain a Stripe secret`);
    }
  }
  ok.push("no embedded Stripe secrets in scanned files");
}

console.log(ok.map((s) => "ok  " + s).join("\n"));
if (fail.length) {
  console.error("\n" + fail.map((s) => "FAIL " + s).join("\n"));
  process.exit(1);
}
console.log("\nAll checks passed (" + ok.length + ")");
