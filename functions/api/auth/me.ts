import { json, error, preflight, asHead, hasDb, hasSessions, bindingsUnavailable, structuredError } from "../../../libs/utils";
import { expiredSessionResponse, getSession, tokenFromRequest } from "../../../libs/auth";
import { ensureReferralCode, isSchemaError, mergeGuestJobs } from "../../../libs/account";
import type { Env } from "../../../libs/utils";

export const onRequestOptions = (): Response => preflight();

/** HEAD /api/auth/me — session liveness only (does not merge guest jobs). */
export const onRequestHead: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!hasDb(env) || !hasSessions(env)) return asHead(bindingsUnavailable("DB+SESSIONS"));
    const token = tokenFromRequest(request);
    const session = await getSession(env, token);
    if (!session) return asHead(expiredSessionResponse());
    return asHead(json({ ok: true }));
  } catch {
    return asHead(structuredError("auth_failed", "Could not load account.", 500));
  }
};

// GET /api/auth/me — current user
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!hasDb(env) || !hasSessions(env)) return bindingsUnavailable("DB+SESSIONS");

    const token = tokenFromRequest(request);
    const session = await getSession(env, token);
    if (!session) return expiredSessionResponse();

    type UserRow = {
      id: number;
      email: string;
      credits: number;
      created_at: string;
      referral_code?: string | null;
      referred_by?: number | null;
      first_purchase_at?: string | null;
    };

    let row: UserRow | null = null;
    try {
      row = await env.DB.prepare(
        "SELECT id, email, credits, created_at, referral_code, referred_by, first_purchase_at FROM users WHERE id = ?"
      )
        .bind(session.userId)
        .first<UserRow>();
    } catch (err) {
      if (!isSchemaError(err)) {
        return structuredError("auth_failed", "Could not load account.", 500);
      }
      row = await env.DB.prepare("SELECT id, email, credits, created_at FROM users WHERE id = ?")
        .bind(session.userId)
        .first<UserRow>();
    }

    if (!row) return error("user not found", 404);

    try {
      await mergeGuestJobs(env, request, Number(row.id));
    } catch {
      /* guest cookie missing or schema — history still loads from D1 */
    }

    let referralCode: string | null = row.referral_code || null;
    try {
      if (!referralCode) referralCode = await ensureReferralCode(env.DB, Number(row.id));
    } catch {
      referralCode = row.referral_code || null;
    }

    const origin = new URL(request.url).origin;
    return json({
      ok: true,
      user: {
        id: row.id,
        email: row.email,
        credits: Number(row.credits),
        created_at: row.created_at,
        referralCode,
        referralUrl: referralCode
          ? `${origin}/auth?mode=register&ref=${encodeURIComponent(referralCode)}`
          : null,
        referredBy: !!row.referred_by,
        firstPurchaseDone: !!row.first_purchase_at,
      },
    });
  } catch {
    return structuredError("auth_failed", "Could not load account.", 500);
  }
};
