import { json, error, preflight, hasDb, hasSessions, bindingsUnavailable } from "../../../libs/utils";
import { hashPassword } from "../../../libs/password";
import { createSession } from "../../../libs/auth";
import type { Env } from "../../../libs/utils";

export const onRequestOptions = (): Response => preflight();

const SIGNUP_CREDITS = 10;

// POST /api/auth/register  { email, password }
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasDb(env) || !hasSessions(env)) return bindingsUnavailable("DB+SESSIONS");

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

  const dup = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (dup) return error("email already registered", 409);

  const { hash, salt } = await hashPassword(password);
  const stored = `${salt}:${hash}`;
  const res = await env.DB.prepare(
    "INSERT INTO users (email, password_hash, credits) VALUES (?, ?, ?)"
  )
    .bind(email, stored, SIGNUP_CREDITS)
    .run();

  if (!res.success) return error("registration failed", 500);

  const userId = Number(res.meta.last_row_id);
  const token = await createSession(env, userId, email);
  return json({ ok: true, token, userId, email, credits: SIGNUP_CREDITS });
};
