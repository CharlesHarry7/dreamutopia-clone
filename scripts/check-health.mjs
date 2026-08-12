#!/usr/bin/env node
/**
 * Smoke-check /api/health (+ optional checkout honesty).
 * Usage: node scripts/check-health.mjs [baseUrl]
 */
const base = (process.argv[2] || "http://127.0.0.1:3000").replace(/\/$/, "");

async function main() {
  const healthRes = await fetch(`${base}/api/health`);
  const health = await healthRes.json().catch(() => ({}));
  console.log("GET /api/health", healthRes.status);
  if (health.runtime) {
    console.log("runtime:", health.runtime);
    if (health.runtime === "next-opennext-workers") {
      console.log("(Next OpenNext Worker — not legacy Pages)");
    }
  } else {
    console.log("runtime: (none) — likely legacy Pages Functions");
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
  if (!healthRes.ok) problems.push("health not ok");
  if (!health.ok) problems.push("health.ok false");
  if (checkout.configured === true && checkoutRes.status !== 200) {
    problems.push("checkout configured but status not 200");
  }
  if (checkout.configured !== true && checkoutRes.status !== 503) {
    problems.push(`expected checkout 503 when not configured, got ${checkoutRes.status}`);
  }

  if (problems.length) {
    console.error("\ncheck-health FAILED:", problems.join("; "));
    process.exit(1);
  }
  console.log("\ncheck-health OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
