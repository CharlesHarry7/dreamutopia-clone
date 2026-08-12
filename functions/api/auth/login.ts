import { json, error, preflight, hasDb, hasSessions, bindingsUnavailable, structuredError } from "../../../libs/utils";
import { verifyPassword } from "../../../libs/password";
import { createSession } from "../../../libs/auth";
import { mergeGuestJobs } from "../../../libs/account";
import { rateLimitedResponse, takeRateLimit } from "../../../libs/rateLimit";
import { clientIp } from "../../../libs/guest";
import type { Env } from "../../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// POST /api/auth/login  { email, password }
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!hasDb(env) || !hasSessions(env)) return bindingsUnavailable("DB+SESSIONS");

    const rl = await takeRateLimit(env.SESSIONS, `login:ip:${clientIp(request) || "unknown"}`, 20, 60);
    if (!rl.ok) return rateLimitedResponse(json, rl.retryAfter);

    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return error("invalid json");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return error("invalid json");
    }
    const body = parsed as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) return error("invalid credentials", 401);

    const row = await env.DB.prepare(
      "SELECT id, email, password_hash, credits FROM users WHERE email = ?"
    )
      .bind(email)
      .first<{ id: number; email: string; password_hash: string; credits: number }>();

    if (!row) return error("invalid credentials", 401);

    const parts = String(row.password_hash).split(":");
    if (parts.length !== 2) return error("invalid credentials", 401);
    const [salt, hash] = parts;

    const ok = await verifyPassword(password, salt, hash);
    if (!ok) return error("invalid credentials", 401);

    const userId = Number(row.id);
    const token = await createSession(env, userId, String(row.email));
    let mergedJobs = 0;
    try {
      mergedJobs = await mergeGuestJobs(env, request, userId);
    } catch {
      mergedJobs = 0;
    }

    return json({
      ok: true,
      token,
      userId,
      email: row.email,
      credits: Number(row.credits),
      mergedJobs,
    });
  } catch {
    return structuredError("auth_failed", "Could not log in. Please try again.", 500);
  }
};
