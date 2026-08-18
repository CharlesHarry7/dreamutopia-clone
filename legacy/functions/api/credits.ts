import { json, preflight, hasDb, hasSessions, bindingsUnavailable } from "../../libs/utils";
import { getSession, tokenFromRequest } from "../../libs/auth";
import {
  GUEST_LIMIT,
  ensureGuestId,
  guestHeaders,
  guestQuota,
  loadGuest,
  clientIp,
} from "../../libs/guest";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// GET /api/credits — signed-in balance, or guest free-trial remaining
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasSessions(env)) return bindingsUnavailable("SESSIONS");

  const token = tokenFromRequest(request);
  const session = await getSession(env, token);
  if (session) {
    if (!hasDb(env)) return bindingsUnavailable("DB");
    const row = await env.DB.prepare("SELECT credits FROM users WHERE id = ?")
      .bind(session.userId)
      .first<{ credits: number }>();
    return json({ ok: true, guest: false, credits: row ? Number(row.credits) : 0 });
  }

  const guestId = ensureGuestId(request);
  const rec = await loadGuest(env, guestId);
  const quota = await guestQuota(env, rec, clientIp(request));
  return json(
    {
      ok: true,
      guest: true,
      credits: 0,
      guestRemaining: quota.remaining,
      guestLimit: GUEST_LIMIT,
    },
    200,
    guestHeaders(guestId, request)
  );
};
