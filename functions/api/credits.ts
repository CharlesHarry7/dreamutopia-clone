import { json, error, preflight, hasDb, hasSessions, bindingsUnavailable } from "../../libs/utils";
import { getSession, tokenFromRequest } from "../../libs/auth";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// GET /api/credits — balance
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasDb(env) || !hasSessions(env)) return bindingsUnavailable("DB+SESSIONS");

  const token = tokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error("unauthorized", 401);

  const row = await env.DB.prepare("SELECT credits FROM users WHERE id = ?")
    .bind(session.userId)
    .first<{ credits: number }>();

  return json({ ok: true, credits: row ? Number(row.credits) : 0 });
};
