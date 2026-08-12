import {
  json,
  error,
  structuredError,
  preflight,
  hasDb,
  hasSessions,
  bindingsUnavailable,
} from "../../../libs/utils";
import { clientIp, hashIp } from "../../../libs/guest";
import { rateLimitedResponse, takeRateLimit } from "../../../libs/rateLimit";
import type { Env } from "../../../libs/utils";

export const onRequestOptions = (): Response => preflight();

/**
 * POST /api/gallery/like
 * Body: { id } — increment likes on a public gallery row.
 * Same IP can like each item once (KV). Rate-limited.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasDb(env)) return bindingsUnavailable("DB");
  if (!hasSessions(env)) return bindingsUnavailable("SESSIONS");

  const ip = clientIp(request) || "unknown";
  const rl = await takeRateLimit(env.SESSIONS, `galike:ip:${ip}`, 40, 3600);
  if (!rl.ok) return rateLimitedResponse(json, rl.retryAfter);

  let body: { id?: unknown };
  try {
    body = (await request.json()) as { id?: unknown };
  } catch {
    return error("invalid json");
  }

  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) {
    return structuredError("invalid_id", "Gallery item id is required.", 400);
  }

  const ipHash = await hashIp(ip);
  const seenKey = `gallery:like:${ipHash}:${id}`;
  const already = await env.SESSIONS.get(seenKey);
  if (already) {
    const row = await env.DB.prepare("SELECT likes FROM gallery WHERE id = ?")
      .bind(id)
      .first<{ likes: number }>();
    if (!row) return structuredError("not_found", "Gallery item not found.", 404);
    return json({ ok: true, already: true, id, likes: Number(row.likes) || 0 });
  }

  const updated = await env.DB.prepare(
    "UPDATE gallery SET likes = likes + 1 WHERE id = ? RETURNING likes"
  )
    .bind(id)
    .first<{ likes: number }>();

  if (!updated) return structuredError("not_found", "Gallery item not found.", 404);

  await env.SESSIONS.put(seenKey, "1", { expirationTtl: 60 * 60 * 24 * 30 });
  return json({ ok: true, already: false, id, likes: Number(updated.likes) || 1 });
};
