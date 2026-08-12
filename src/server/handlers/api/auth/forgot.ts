import { json, error, preflight, hasDb, hasSessions, bindingsUnavailable } from "@/server/libs/utils";
import { hasMailer, sendResetEmail } from "@/server/libs/mail";
import { rateLimitedResponse, takeRateLimit } from "@/server/libs/rateLimit";
import { clientIp } from "@/server/libs/guest";
import type { Env } from "@/server/libs/utils";

export const onRequestOptions = (): Response => preflight();

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
