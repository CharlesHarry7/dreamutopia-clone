import { json, preflight } from "../../../libs/utils";
import { destroySession, tokenFromRequest } from "../../../libs/auth";
import type { Env } from "../../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// POST /api/auth/logout
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const token = tokenFromRequest(request);
  await destroySession(env, token);
  return json({ ok: true });
};
