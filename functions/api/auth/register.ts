import { json, error, preflight, hasDb, hasSessions, bindingsUnavailable } from "../../../libs/utils";
import { hashPassword } from "../../../libs/password";
import { createSession } from "../../../libs/auth";
import {
  ensureReferralCode,
  isSchemaError,
  lookupReferrer,
  makeReferralCode,
  mergeGuestJobs,
} from "../../../libs/account";
import { hasMailer, sendWelcomeEmail } from "../../../libs/mail";
import { rateLimitedResponse, takeRateLimit } from "../../../libs/rateLimit";
import { clientIp } from "../../../libs/guest";
import type { Env } from "../../../libs/utils";

export const onRequestOptions = (): Response => preflight();

const SIGNUP_CREDITS = 10;

// POST /api/auth/register  { email, password, referralCode? }
export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  if (!hasDb(env) || !hasSessions(env)) return bindingsUnavailable("DB+SESSIONS");

  const rl = await takeRateLimit(env.SESSIONS, `reg:ip:${clientIp(request) || "unknown"}`, 8, 3600);
  if (!rl.ok) return rateLimitedResponse(json, rl.retryAfter);

  let body: { email?: string; password?: string; referralCode?: string };
  try {
    body = await request.json();
  } catch {
    return error("invalid json");
  }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error("invalid email");
  if (password.length < 6) return error("password must be at least 6 characters");

  const dup = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (dup) return error("email already registered", 409);

  const { hash, salt } = await hashPassword(password);
  const stored = `${salt}:${hash}`;
  const referralCode = makeReferralCode();
  const referredBy = await lookupReferrer(env.DB, body.referralCode).catch((err) => {
    if (isSchemaError(err)) return null;
    throw err;
  });

  let res: { success: boolean; meta: { last_row_id?: number | string } };
  try {
    res = await env.DB.prepare(
      "INSERT INTO users (email, password_hash, credits, referral_code, referred_by) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(email, stored, SIGNUP_CREDITS, referralCode, referredBy)
      .run();
  } catch (err) {
    if (isSchemaError(err)) {
      return json(
        {
          error: "schema_migration_required",
          code: "schema_migration_required",
          message: "Run migrations/003_referrals_credits.sql on D1.",
        },
        503
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint failed: users.referral_code/i.test(msg)) {
      res = await env.DB.prepare(
        "INSERT INTO users (email, password_hash, credits, referral_code, referred_by) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(email, stored, SIGNUP_CREDITS, makeReferralCode(), referredBy)
        .run();
    } else {
      return error("registration failed", 500);
    }
  }

  if (!res.success) return error("registration failed", 500);

  const userId = Number(res.meta.last_row_id);
  const token = await createSession(env, userId, email);
  let mergedJobs = 0;
  try {
    mergedJobs = await mergeGuestJobs(env, request, userId);
  } catch {
    mergedJobs = 0;
  }

  let code = referralCode;
  try {
    code = await ensureReferralCode(env.DB, userId);
  } catch {
    /* column missing — already returned 503 above */
  }

  const origin = new URL(request.url).origin;
  if (hasMailer(env)) {
    waitUntil(sendWelcomeEmail(env, { to: email, origin }).then(() => undefined));
  }
  return json({
    ok: true,
    token,
    userId,
    email,
    credits: SIGNUP_CREDITS,
    mergedJobs,
    referralCode: code,
    referralUrl: `${origin}/auth?mode=register&ref=${encodeURIComponent(code)}`,
  });
};
