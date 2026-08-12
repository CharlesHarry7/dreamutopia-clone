// Shared helpers + Env typing for Pages Functions

/** Cloudflare bindings — optional until provisioned in dashboard / wrangler.toml */
export interface Env {
  DB?: D1Database;
  SESSIONS?: KVNamespace;
  /** R2 media bucket — file uploads (POST /api/upload). Generate can still use a public imageUrl without MEDIA. */
  MEDIA?: R2Bucket;
  /** Pages secret — required for real KIE image-to-video */
  KIE_API_KEY?: string;
  KIE_API_BASE?: string;
  /** Stripe Checkout (optional). Without it, GET /api/checkout returns configured:false. */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** Resend (optional). Without it, POST /api/auth/forgot returns email_not_configured. */
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  /** Optional KIE callback HMAC (kie.ai Settings → webhookHmacKey). */
  KIE_WEBHOOK_HMAC_KEY?: string;
}

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization, Idempotency-Key",
};

export function json(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...(extraHeaders || {}),
    },
  });
}

export function error(msg: string, status = 400): Response {
  return json({ error: msg }, status);
}

/** Structured API error: { error, code, message, ... } */
export function structuredError(
  code: string,
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
  extraHeaders?: Record<string, string>
): Response {
  return json({ error: code, code, message, ...(extra || {}) }, status, extraHeaders);
}

export function hasKieKey(env: Env): env is Env & { KIE_API_KEY: string } {
  return typeof env.KIE_API_KEY === "string" && env.KIE_API_KEY.trim().length > 0;
}

/** OPTIONS preflight with CORS headers (required for browser Authorization) */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** HEAD with the same status/headers as a GET, no body (crawlers / uptime checks). */
export function asHead(res: Response): Response {
  return new Response(null, { status: res.status, headers: res.headers });
}

export function randomId(prefix = "gen"): string {
  const rand = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

export function hasDb(env: Env): env is Env & { DB: D1Database } {
  return !!env.DB;
}

export function hasSessions(env: Env): env is Env & { SESSIONS: KVNamespace } {
  return !!env.SESSIONS;
}

export function hasMedia(env: Env): env is Env & { MEDIA: R2Bucket } {
  return !!env.MEDIA;
}

/** 503 when D1 / KV not bound yet (see BACKEND.md) */
export function bindingsUnavailable(which: "DB" | "SESSIONS" | "DB+SESSIONS"): Response {
  return error(
    `backend not configured: missing ${which} binding — create D1/KV and bind in Pages settings (see BACKEND.md)`,
    503
  );
}
