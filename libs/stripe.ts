/** Stripe Checkout + webhook verify via fetch (no Node SDK). */

import { PACKS, type CreditPack } from "./packs";
import { safeEqual } from "./password";

const STRIPE_API = "https://api.stripe.com/v1/checkout/sessions";

export function hasStripe(env: { STRIPE_SECRET_KEY?: string }): boolean {
  return typeof env.STRIPE_SECRET_KEY === "string" && env.STRIPE_SECRET_KEY.trim().length > 0;
}

export function hasStripeWebhook(env: { STRIPE_WEBHOOK_SECRET?: string }): boolean {
  return typeof env.STRIPE_WEBHOOK_SECRET === "string" && env.STRIPE_WEBHOOK_SECRET.trim().length > 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verify `Stripe-Signature` against the raw webhook body. */
export async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  toleranceSec = 300
): Promise<boolean> {
  if (!payload || !header || !secret) return false;
  let timestamp = "";
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const [k, ...rest] = part.trim().split("=");
    const v = rest.join("=");
    if (k === "t") timestamp = v;
    if (k === "v1") v1.push(v);
  }
  if (!timestamp || !v1.length) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;
  const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  return v1.some((sig) => sig.length === expected.length && safeEqual(sig, expected));
}

export async function createCheckoutSession(opts: {
  secretKey: string;
  origin: string;
  userId: number;
  email: string;
  pack: CreditPack;
}): Promise<{ ok: true; url: string; id: string } | { ok: false; status: number; message: string }> {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${opts.origin}/workspace?checkout=success`);
  params.set("cancel_url", `${opts.origin}/pricing?checkout=cancel`);
  params.set("client_reference_id", String(opts.userId));
  params.set("customer_email", opts.email);
  params.set("metadata[userId]", String(opts.userId));
  params.set("metadata[pack]", opts.pack.id);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(opts.pack.usdCents));
  params.set("line_items[0][price_data][product_data][name]", opts.pack.name);
  params.set(
    "line_items[0][price_data][product_data][description]",
    `${opts.pack.credits} credits`
  );

  let res: Response;
  try {
    res = await fetch(STRIPE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
  } catch (e) {
    return { ok: false, status: 502, message: e instanceof Error ? e.message : "Stripe request failed" };
  }

  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };
  if (!res.ok || !body.url || !body.id) {
    return {
      ok: false,
      status: res.status || 502,
      message: body.error?.message || "Stripe Checkout session failed",
    };
  }
  return { ok: true, url: body.url, id: body.id };
}

export function packFromMetadata(pack: unknown): CreditPack | null {
  if (typeof pack !== "string") return null;
  return PACKS[pack as keyof typeof PACKS] || null;
}
