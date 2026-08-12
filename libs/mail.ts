/** Optional Resend transactional email (password reset + welcome). */

export function hasMailer(env: { RESEND_API_KEY?: string; MAIL_FROM?: string }): boolean {
  return typeof env.RESEND_API_KEY === "string" && env.RESEND_API_KEY.trim().length > 0;
}

export async function sendEmail(
  env: { RESEND_API_KEY?: string; MAIL_FROM?: string },
  params: { to: string; subject: string; html: string }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const key = env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, message: "RESEND_API_KEY is not set" };
  const from = (env.MAIL_FROM || "").trim() || "DreamUtopia <noreply@mail.dreamutopia-clone.pages.dev>";

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "mail request failed" };
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, message: body.message || `Resend HTTP ${res.status}` };
  }
  return { ok: true };
}

export async function sendResetEmail(
  env: { RESEND_API_KEY?: string; MAIL_FROM?: string },
  opts: { to: string; resetUrl: string }
): Promise<{ ok: true } | { ok: false; message: string }> {
  return sendEmail(env, {
    to: opts.to,
    subject: "Reset your DreamUtopia password",
    html: `<p>Reset your password using this link (valid for 1 hour):</p><p><a href="${opts.resetUrl}">${opts.resetUrl}</a></p><p>If you did not ask for this, ignore the email.</p>`,
  });
}

export async function sendWelcomeEmail(
  env: { RESEND_API_KEY?: string; MAIL_FROM?: string },
  opts: { to: string; origin: string }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const workspace = `${opts.origin.replace(/\/$/, "")}/workspace`;
  return sendEmail(env, {
    to: opts.to,
    subject: "Welcome to DreamUtopia — 10 credits ready",
    html: `<p>Your account is ready with <strong>10 credits</strong>.</p><p><a href="${workspace}">Open the workspace</a> to turn photos into video.</p><p>Invite friends from the workspace — they get started, you earn 10% of their first pack.</p>`,
  });
}
