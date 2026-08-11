import { json, preflight } from "../../libs/utils";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// GET /api/gallery — 作品墙 (最新 30 条公开作品)
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const rows = await env.DB.prepare(
    "SELECT id, media_key, prompt, likes, created_at FROM gallery ORDER BY created_at DESC LIMIT 30"
  ).all();

  return json({ ok: true, items: rows.results });
};
