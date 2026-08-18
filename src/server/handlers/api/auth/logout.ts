import { json, preflight, hasSessions, bindingsUnavailable } from "@/server/libs/utils";
import { destroySession, tokenFromRequest } from "@/server/libs/auth";
import type { Env } from "@/server/libs/utils";

export const onRequestOptions = (): Response => preflight();

// POST /api/auth/logout
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasSessions(env)) return bindingsUnavailable("SESSIONS");
  const token = tokenFromRequest(request);
  await destroySession(env, token);
  return json({ ok: true });
};
