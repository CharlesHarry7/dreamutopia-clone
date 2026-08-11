import { json, error, preflight, hasDb, hasSessions, bindingsUnavailable } from "../../../libs/utils";
import { getSession, tokenFromRequest } from "../../../libs/auth";
import type { Env } from "../../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// GET /api/auth/me — current user
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasDb(env) || !hasSessions(env)) return bindingsUnavailable("DB+SESSIONS");

  const token = tokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error("unauthorized", 401);

  const row = await env.DB.prepare("SELECT id, email, credits, created_at FROM users WHERE id = ?")
    .bind(session.userId)
    .first<{ id: number; email: string; credits: number; created_at: string }>();

  if (!row) return error("user not found", 404);

  return json({
    ok: true,
    user: {
      id: row.id,
      email: row.email,
      credits: Number(row.credits),
      created_at: row.created_at,
    },
  });
};
