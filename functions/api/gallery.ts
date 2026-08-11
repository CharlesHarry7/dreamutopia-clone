import { json, preflight, hasDb } from "../../libs/utils";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// GET /api/gallery — public showcase (empty when DB not bound)
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!hasDb(env)) {
    return json({ ok: true, demo: true, items: [] });
  }

  const rows = await env.DB.prepare(
    "SELECT id, media_key, prompt, likes, created_at FROM gallery ORDER BY created_at DESC LIMIT 30"
  ).all();

  return json({ ok: true, demo: false, items: rows.results || [] });
};
