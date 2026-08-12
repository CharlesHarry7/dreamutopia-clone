#!/usr/bin/env node
/**
 * Smoke-check /api/health (+ checkout honesty).
 *
 * Usage:
 *   node scripts/check-health.mjs [baseUrl]
 *   node scripts/check-health.mjs https://xxx.workers.dev --expect-worker
 *   node scripts/check-health.mjs https://dreamutopia-clone.pages.dev --expect-pages
 */
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const base = (args[0] || "http://127.0.0.1:3000").replace(/\/$/, "");
const expectWorker = flags.has("--expect-worker");
const expectPages = flags.has("--expect-pages");

async function main() {
  const healthRes = await fetch(`${base}/api/health`);
  const health = await healthRes.json().catch(() => ({}));
  console.log("GET /api/health", healthRes.status);
  console.log("host:", base);

  if (health.runtime === "next-opennext-workers") {
    console.log("runtime: next-opennext-workers (Next OpenNext Worker)");
  } else if (health.runtime) {
    console.log("runtime:", health.runtime);
  } else {
    console.log("runtime: (none) — likely legacy Pages Functions");
  }
  if (health.productionSurface) {
    console.log("productionSurface:", health.productionSurface);
  }
  console.log(JSON.stringify(health, null, 2));

  const checkoutRes = await fetch(`${base}/api/checkout`);
  const checkout = await checkoutRes.json().catch(() => ({}));
  console.log("\nGET /api/checkout", checkoutRes.status);
  console.log(
    JSON.stringify(
      {
        ok: checkout.ok,
        configured: checkout.configured,
        code: checkout.code,
        packs: Array.isArray(checkout.packs) ? checkout.packs.length : 0,
      },
      null,
      2
    )
  );

  const problems = [];
  if (!healthRes.ok) problems.push(`health HTTP ${healthRes.status}`);
  if (health.ok !== true) problems.push("health.ok !== true");
  if (typeof health.service !== "string") problems.push("missing health.service");
  if (typeof health.bindings !== "object" || !health.bindings) {
    problems.push("missing health.bindings");
  } else {
    for (const k of ["DB", "SESSIONS", "MEDIA"]) {
      if (typeof health.bindings[k] !== "boolean") problems.push(`bindings.${k} not boolean`);
    }
  }
  for (const k of [
    "authReady",
    "kieConfigured",
    "generateReady",
    "uploadReady",
    "checkoutConfigured",
  ]) {
    if (typeof health[k] !== "boolean") problems.push(`missing boolean ${k}`);
  }

  if (expectWorker) {
    if (health.runtime !== "next-opennext-workers") {
      problems.push(`--expect-worker but runtime=${JSON.stringify(health.runtime)}`);
    }
    if (typeof health.guestTrialsReady !== "boolean") {
      problems.push("missing boolean guestTrialsReady");
    }
    if (typeof health.degraded !== "boolean") {
      problems.push("missing boolean degraded");
    }
    if (health.productionSurface !== "pages-until-cutover") {
      problems.push(
        `expected productionSurface=pages-until-cutover, got ${JSON.stringify(health.productionSurface)}`
      );
    }
    if (!health.probes || typeof health.probes !== "object") {
      problems.push("missing health.probes");
    }
  }
  if (expectPages) {
    if (health.runtime === "next-opennext-workers") {
      problems.push("--expect-pages but got next-opennext-workers runtime");
    }
  }

  if (health.degraded === true) {
    problems.push("health.degraded true (binding probe failed)");
  }

  if (checkout.configured === true && checkoutRes.status !== 200) {
    problems.push("checkout configured but status not 200");
  }
  if (checkout.configured !== true && checkoutRes.status !== 503) {
    problems.push(`expected checkout 503 when not configured, got ${checkoutRes.status}`);
  }
  if (checkout.configured === false && checkout.code !== "checkout_not_configured") {
    problems.push("checkout not configured but code missing checkout_not_configured");
  }

  if (problems.length) {
    console.error("\ncheck-health FAILED:", problems.join("; "));
    process.exit(1);
  }
  console.log("\ncheck-health OK");
  if (!expectWorker && health.runtime === "next-opennext-workers") {
    console.log("tip: use --expect-worker to assert Next Worker runtime in CI");
  }
  if (health.livePagesHint) {
    console.log(
      "note: live production may still be Pages at",
      health.livePagesHint,
      "(see DEPLOY.md)"
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
