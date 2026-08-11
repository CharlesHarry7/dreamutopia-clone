import { json, error, preflight } from "../../../libs/utils";
import { verifyPassword, safeEqual } from "../../../libs/password";
import { createSession } from "../../../libs/auth";
import type { Env } from "../../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// POST /api/auth/login  { email, password }
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return error("invalid json");
  }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  const row = await env.DB.prepare("SELECT id, email, password_hash, credits FROM users WHERE email = ?").bind(email).first();
  if (!row) return error("invalid credentials", 401);

  const [salt, hash] = String(row.password_hash).split(":");
  const ok = await verifyPassword(password, salt, hash);
  if (!ok || !safeEqual) return error("invalid credentials", 401);

  const token = await createSession(env, Number(row.id), String(row.email));
  return json({ ok: true, token, userId: Number(row.id), email: row.email, credits: Number(row.credits) });
};
