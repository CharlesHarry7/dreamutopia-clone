/** Optional Resend transactional email (password reset). */

export function hasMailer(env: { RESEND_API_KEY?: string; MAIL_FROM?: string }): boolean {
  return typeof env.RESEND_API_KEY === "string" && env.RESEND_API_KEY.trim().length > 0;
}

export async function sendResetEmail(
  env: { RESEND_API_KEY?: string; MAIL_FROM?: string },
  opts: { to: string; resetUrl: string }
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
        to: [opts.to],
        subject: "Reset your DreamUtopia password",
        html: `<p>Reset your password using this link (valid for 1 hour):</p><p><a href="${opts.resetUrl}">${opts.resetUrl}</a></p><p>If you did not ask for this, ignore the email.</p>`,
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
