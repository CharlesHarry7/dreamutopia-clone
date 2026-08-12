#!/usr/bin/env node
/**
 * Smoke-check /api/health (+ checkout honesty).
 *
 * Usage:
 *   node scripts/check-health.mjs [baseUrl]
 *   node scripts/check-health.mjs https://xxx.workers.dev --expect-worker
 *   node scripts/check-health.mjs https://dreamutopia-clone.pages.dev --expect-pages
 *
 * While live traffic is still Pages, Worker health must keep
 * productionSurface=pages-until-cutover (see DEPLOY.md).
 */
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const base = (args[0] || "http://127.0.0.1:3000").replace(/\/$/, "");
const expectWorker = flags.has("--expect-worker");
const expectPages = flags.has("--expect-pages");
const FETCH_MS = 12_000;

async function fetchJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  } finally {
    clearTimeout(timer);
  }
}

function probeOk(probe, name, problems) {
  if (!probe || typeof probe !== "object") {
    problems.push(`probes.${name} missing`);
    return;
  }
  if (typeof probe.ok !== "boolean") {
    problems.push(`probes.${name}.ok not boolean`);
  }
}

async function main() {
  if (expectWorker && expectPages) {
    console.error("check-health FAILED: use only one of --expect-worker / --expect-pages");
    process.exit(1);
  }

  const { res: healthRes, body: health } = await fetchJson(`${base}/api/health`);
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

  const { res: checkoutRes, body: checkout } = await fetchJson(`${base}/api/checkout`);
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
    if (health.guestTrials !== true) {
      problems.push(`expected guestTrials=true, got ${JSON.stringify(health.guestTrials)}`);
    }
    if (typeof health.guestLimit !== "number" || health.guestLimit < 1) {
      problems.push(`expected guestLimit >= 1, got ${JSON.stringify(health.guestLimit)}`);
    }
    if (typeof health.degraded !== "boolean") {
      problems.push("missing boolean degraded");
    }
    // Live production remains Pages until DEPLOY.md cutover — Worker must not claim cutover.
    if (health.productionSurface !== "pages-until-cutover") {
      problems.push(
        `expected productionSurface=pages-until-cutover, got ${JSON.stringify(health.productionSurface)}`
      );
    }
    if (health.cutoverComplete !== false) {
      problems.push(
        `expected cutoverComplete=false while Pages is live, got ${JSON.stringify(health.cutoverComplete)}`
      );
    }
    if (health.livePagesHint !== "https://dreamutopia-clone.pages.dev") {
      problems.push(
        `expected livePagesHint=https://dreamutopia-clone.pages.dev, got ${JSON.stringify(health.livePagesHint)}`
      );
    }
    if (!health.probes || typeof health.probes !== "object") {
      problems.push("missing health.probes");
    } else {
      probeOk(health.probes.DB, "DB", problems);
      probeOk(health.probes.SESSIONS, "SESSIONS", problems);
    }
  }
  if (expectPages) {
    if (health.runtime === "next-opennext-workers") {
      problems.push("--expect-pages but got next-opennext-workers runtime");
    }
    if (health.productionSurface === "pages-until-cutover") {
      // Pages Functions do not emit this field; if they start to, it is fine —
      // but Worker-only fields on Pages would be surprising.
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
    console.log("tip: use --expect-worker to assert Next Worker runtime + pages-until-cutover");
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
  const name = err && err.name === "AbortError" ? `fetch timed out after ${FETCH_MS}ms` : err;
  console.error(name);
  process.exit(1);
});
