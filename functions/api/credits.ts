import { json, error, preflight } from "../../libs/utils";
import { getSession, tokenFromRequest } from "../../libs/auth";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// GET /api/credits — 查询余额
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const token = tokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error("unauthorized", 401);

  const row = await env.DB.prepare("SELECT credits FROM users WHERE id = ?").bind(session.userId).first();
  return json({ ok: true, credits: row ? Number(row.credits) : 0 });
};
