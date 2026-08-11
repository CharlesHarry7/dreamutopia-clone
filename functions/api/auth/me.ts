import { json, error, preflight } from "../../../libs/utils";
import { getSession, tokenFromRequest } from "../../../libs/auth";
import type { Env } from "../../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// GET /api/auth/me — 返回当前用户信息
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const token = tokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error("unauthorized", 401);

  const row = await env.DB.prepare("SELECT id, email, credits, created_at FROM users WHERE id = ?")
    .bind(session.userId).first();
  if (!row) return error("user not found", 404);

  return json({ ok: true, user: { id: row.id, email: row.email, credits: row.credits, created_at: row.created_at } });
};
