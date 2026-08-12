import {
  json,
  error,
  structuredError,
  preflight,
  hasDb,
  hasSessions,
  hasMedia,
  bindingsUnavailable,
} from "../../libs/utils";
import { getSession, tokenFromRequest } from "../../libs/auth";
import {
  isSafeMediaKey,
  mediaKeyFromUrl,
  publicMediaUrl,
  persistRemoteMedia,
  kindFromMediaKey,
} from "../../libs/media";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

type GalleryRow = {
  id: number;
  generation_id: number | null;
  media_key: string;
  prompt: string;
  likes: number;
  created_at: string;
};

function publicItem(origin: string, row: GalleryRow) {
  return {
    id: row.id,
    generationId: row.generation_id,
    mediaKey: row.media_key,
    prompt: row.prompt,
    likes: row.likes,
    createdAt: row.created_at,
    url: publicMediaUrl(origin, row.media_key),
    kind: kindFromMediaKey(row.media_key),
  };
}

// GET /api/gallery — public showcase (empty when DB not bound)
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const origin = new URL(request.url).origin;
  if (!hasDb(env)) {
    return json({ ok: true, demo: true, items: [] });
  }

  const rows = await env.DB.prepare(
    "SELECT id, generation_id, media_key, prompt, likes, created_at FROM gallery ORDER BY created_at DESC LIMIT 30"
  ).all<GalleryRow>();

  const items = (rows.results || [])
    .filter((r) => r.media_key && isSafeMediaKey(r.media_key))
    .map((r) => publicItem(origin, r));

  return json({ ok: true, demo: false, items });
};

/**
 * POST /api/gallery — opt-in publish of a finished account generation.
 * Body: { generationId }
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasSessions(env)) return bindingsUnavailable("SESSIONS");
  if (!hasDb(env)) return bindingsUnavailable("DB");

  const token = tokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) {
    return structuredError("unauthorized", "Sign in to share a creation to the gallery.", 401);
  }

  let body: { generationId?: unknown; generation_id?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return error("invalid json");
  }

  const generationId = Number(body.generationId ?? body.generation_id);
  if (!Number.isFinite(generationId) || generationId <= 0) {
    return structuredError("invalid_generation", "generationId is required.", 400);
  }

  const row = await env.DB.prepare(
    `SELECT id, user_id, prompt, status, media_key, result_url
     FROM generations WHERE id = ? AND user_id = ?`
  )
    .bind(generationId, session.userId)
    .first<{
      id: number;
      user_id: number;
      prompt: string;
      status: string;
      media_key: string | null;
      result_url: string | null;
    }>();

  if (!row) return structuredError("not_found", "Generation not found.", 404);
  if (row.status !== "done") {
    return structuredError("not_ready", "Wait until the generation finishes before sharing.", 409);
  }

  const existing = await env.DB.prepare("SELECT id FROM gallery WHERE generation_id = ?")
    .bind(generationId)
    .first<{ id: number }>();
  if (existing) {
    return json({
      ok: true,
      already: true,
      id: existing.id,
      message: "Already in the gallery.",
    });
  }

  const origin = new URL(request.url).origin;
  let mediaKey = row.media_key && isSafeMediaKey(row.media_key) ? row.media_key : null;
  if (!mediaKey && row.result_url) mediaKey = mediaKeyFromUrl(row.result_url);

  if (!mediaKey && row.result_url && hasMedia(env)) {
    try {
      const copied = await persistRemoteMedia(env.MEDIA, {
        userId: session.userId,
        sourceUrl: row.result_url,
        origin,
      });
      if (copied) {
        mediaKey = mediaKeyFromUrl(copied);
        if (mediaKey) {
          await env.DB.prepare("UPDATE generations SET result_url = ?, media_key = ? WHERE id = ?")
            .bind(copied, mediaKey, row.id)
            .run();
        }
      }
    } catch {
      /* keep going — may still fail below */
    }
  }

  if (!mediaKey) {
    return structuredError(
      "result_not_stored",
      "This result is not stored on our media bucket yet, so it cannot go in the public gallery.",
      409
    );
  }

  const prompt = (row.prompt || "").slice(0, 500);
  try {
    const inserted = await env.DB.prepare(
      "INSERT INTO gallery (generation_id, media_key, prompt) VALUES (?, ?, ?) RETURNING id, generation_id, media_key, prompt, likes, created_at"
    )
      .bind(generationId, mediaKey, prompt)
      .first<GalleryRow>();

    if (!inserted) return structuredError("publish_failed", "Could not publish to gallery.", 500);

    return json({ ok: true, already: false, item: publicItem(origin, inserted) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/unique|constraint/i.test(msg)) {
      const again = await env.DB.prepare("SELECT id FROM gallery WHERE generation_id = ?")
        .bind(generationId)
        .first<{ id: number }>();
      return json({
        ok: true,
        already: true,
        id: again?.id || null,
        message: "Already in the gallery.",
      });
    }
    throw e;
  }
};
