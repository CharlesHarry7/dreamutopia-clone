import { json, error, preflight, asHead, hasDb, hasSessions, bindingsUnavailable } from "../../../libs/utils";
import { hasMailer, sendResetEmail } from "../../../libs/mail";
import { rateLimitedResponse, takeRateLimit } from "../../../libs/rateLimit";
import { clientIp } from "../../../libs/guest";
import type { Env } from "../../../libs/utils";

export const onRequestOptions = (): Response => preflight();

/**
 * GET /api/auth/forgot — probe only (does not send mail).
 * Honest 503 until Resend secrets exist, same idea as GET /api/checkout.
 */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!hasMailer(env)) {
    return json(
      {
        ok: false,
        configured: false,
        error: "email_not_configured",
        code: "email_not_configured",
        message: "Set Pages secrets RESEND_API_KEY and MAIL_FROM to send reset emails.",
      },
      503
    );
  }
  return json({ ok: true, configured: true });
};

export const onRequestHead: PagesFunction<Env> = async (ctx) => asHead(await onRequestGet(ctx));

const RESET_TTL = 60 * 60;

function resetToken(): string {
  const rand = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
}

// POST /api/auth/forgot  { email }
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasDb(env) || !hasSessions(env)) return bindingsUnavailable("DB+SESSIONS");
  if (!hasMailer(env)) {
    return json(
      {
        error: "email_not_configured",
        code: "email_not_configured",
        message: "Set Pages secrets RESEND_API_KEY and MAIL_FROM to send reset emails.",
      },
      503
    );
  }

  const rl = await takeRateLimit(env.SESSIONS, `forgot:ip:${clientIp(request) || "unknown"}`, 5, 3600);
  if (!rl.ok) return rateLimitedResponse(json, rl.retryAfter);

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return error("invalid json");
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ ok: true });
  }

  const row = await env.DB.prepare("SELECT id, email FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: number; email: string }>();

  if (row) {
    const token = resetToken();
    await env.SESSIONS.put(`reset:${token}`, JSON.stringify({ userId: Number(row.id) }), {
      expirationTtl: RESET_TTL,
    });
    const origin = new URL(request.url).origin;
    const sent = await sendResetEmail(env, {
      to: String(row.email),
      resetUrl: `${origin}/reset?token=${encodeURIComponent(token)}`,
    });
    if (!sent.ok) {
      return json({ error: "email_send_failed", message: sent.message }, 502);
    }
  }

  return json({ ok: true });
};

/**
 * Pages on some deploys does not invoke onRequestHead — HEAD then hits the SPA
 * (live: 200 text/html). onRequest is the fallback so HEAD/OPTIONS match GET/POST.
 */
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const method = ctx.request.method;
  if (method === "HEAD") return asHead(await onRequestGet(ctx));
  if (method === "OPTIONS") return onRequestOptions();
  if (method === "GET") return onRequestGet(ctx);
  if (method === "POST") return onRequestPost(ctx);
  return json({ error: "method_not_allowed", code: "method_not_allowed" }, 405);
};
