import { json, error, preflight, hasDb, hasSessions, bindingsUnavailable } from "@/server/libs/utils";
import { hashPassword } from "@/server/libs/password";
import { createSession } from "@/server/libs/auth";
import type { Env } from "@/server/libs/utils";

export const onRequestOptions = (): Response => preflight();

// POST /api/auth/reset  { token, password }
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasDb(env) || !hasSessions(env)) return bindingsUnavailable("DB+SESSIONS");

  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return error("invalid json");
  }

  const token = (body.token || "").trim();
  const password = body.password || "";
  if (!/^[a-f0-9]{32}$/.test(token)) return error("invalid or expired token", 400);
  if (password.length < 6) return error("password must be at least 6 characters");

  const raw = await env.SESSIONS.get(`reset:${token}`);
  if (!raw) return error("invalid or expired token", 400);

  let userId = 0;
  try {
    const parsed = JSON.parse(raw) as { userId?: number };
    userId = Number(parsed.userId) || 0;
  } catch {
    return error("invalid or expired token", 400);
  }
  if (!userId) return error("invalid or expired token", 400);

  const row = await env.DB.prepare("SELECT id, email FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: number; email: string }>();
  if (!row) return error("invalid or expired token", 400);

  const { hash, salt } = await hashPassword(password);
  await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .bind(`${salt}:${hash}`, userId)
    .run();
  await env.SESSIONS.delete(`reset:${token}`);

  const session = await createSession(env, Number(row.id), String(row.email));
  return json({ ok: true, token: session, userId: Number(row.id), email: row.email });
};
