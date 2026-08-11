import { json, error, preflight } from "../../../libs/utils";
import { hashPassword } from "../../../libs/password";
import { createSession } from "../../../libs/auth";
import type { Env } from "../../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// POST /api/auth/register  { email, password }
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return error("invalid json");
  }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error("invalid email");
  if (password.length < 6) return error("password must be at least 6 characters");

  // 查重
  const dup = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (dup) return error("email already registered", 409);

  const { hash, salt } = await hashPassword(password);
  const stored = `${salt}:${hash}`;
  const res = await env.DB.prepare(
    "INSERT INTO users (email, password_hash, credits) VALUES (?, ?, 10)"
  ).bind(email, stored).run();

  const userId = Number(res.meta.last_row_id);
  const token = await createSession(env, userId, email);
  return json({ ok: true, token, userId, email, credits: 10 });
};
