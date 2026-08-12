/** KIE Market callback helpers — HMAC from https://docs.kie.ai/common-api/webhook-verification */

import { safeEqual } from "./password";

export function hasKieWebhookHmac(env: { KIE_WEBHOOK_HMAC_KEY?: string }): boolean {
  return typeof env.KIE_WEBHOOK_HMAC_KEY === "string" && env.KIE_WEBHOOK_HMAC_KEY.trim().length > 0;
}

export function extractKieTaskId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const data = o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : null;
  const candidates = [o.taskId, o.task_id, data?.taskId, data?.task_id];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(mac);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Verify `X-Webhook-Signature` = base64(HMAC-SHA256(taskId + "." + timestamp, key)).
 * When the HMAC key is not configured, returns `{ ok: true, skipped: true }`.
 */
export async function verifyKieWebhookSignature(opts: {
  secret?: string;
  taskId: string;
  timestamp: string | null;
  signature: string | null;
  toleranceSec?: number;
}): Promise<{ ok: true; skipped?: boolean } | { ok: false; reason: string }> {
  const secret = (opts.secret || "").trim();
  if (!secret) return { ok: true, skipped: true };
  if (!opts.timestamp || !opts.signature) return { ok: false, reason: "missing_signature_headers" };
  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "invalid_timestamp" };
  const tolerance = opts.toleranceSec ?? 300;
  if (Math.abs(Date.now() / 1000 - ts) > tolerance) return { ok: false, reason: "timestamp_expired" };
  const expected = await hmacSha256Base64(secret, `${opts.taskId}.${opts.timestamp}`);
  if (expected.length !== opts.signature.length || !safeEqual(expected, opts.signature)) {
    return { ok: false, reason: "invalid_signature" };
  }
  return { ok: true };
}

export function kieCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/webhooks/kie`;
}
