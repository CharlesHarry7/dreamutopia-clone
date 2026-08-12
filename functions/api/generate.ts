import {
  json,
  error,
  structuredError,
  preflight,
  hasDb,
  hasSessions,
  hasKieKey,
  hasMedia,
} from "../../libs/utils";
import { getSession, tokenFromRequest } from "../../libs/auth";
import {
  createImageToVideoTask,
  createImageTask,
  getTaskInfo,
  isPublicHttpsUrl,
} from "../../libs/kie";
import { isSafeMediaKey, mediaKeyFromUrl, persistRemoteMedia } from "../../libs/media";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// Credits per generation
const VIDEO_COST: Record<string, number> = { lite: 3, medium: 5, pro: 16 };
const IMAGE_COST: Record<string, number> = { lite: 1, pro: 2 };

type GenerationKind = "video" | "image";

function parseStoredModel(stored: string): { kind: GenerationKind; model: string } {
  if (stored.startsWith("image-")) {
    const model = stored.slice(6);
    return { kind: "image", model: IMAGE_COST[model] ? model : "lite" };
  }
  return { kind: "video", model: VIDEO_COST[stored] ? stored : "lite" };
}

function storeModel(kind: GenerationKind, model: string): string {
  return kind === "image" ? `image-${model}` : model;
}

type GenerationRow = {
  id: number;
  user_id: number;
  model: string;
  prompt: string;
  status: string;
  media_key: string | null;
  duration_sec: number | null;
  input_image_url: string | null;
  provider_job_id: string | null;
  result_url: string | null;
  error_message: string | null;
  created_at: string;
};

function kieMissingResponse(): Response {
  return structuredError(
    "kie_api_key_missing",
    "KIE_API_KEY is not configured. Set it as a Cloudflare Pages secret to enable generation.",
    503,
    { kieConfigured: false, mediaRequired: false }
  );
}

async function refundCredits(env: Env & { DB: D1Database }, userId: number, cost: number) {
  await env.DB.prepare("UPDATE users SET credits = credits + ? WHERE id = ?")
    .bind(cost, userId)
    .run();
}

async function syncProviderStatus(
  env: Env & { DB: D1Database; KIE_API_KEY: string },
  row: GenerationRow,
  origin: string
): Promise<GenerationRow> {
  if (row.status !== "processing" || !row.provider_job_id) return row;

  const info = await getTaskInfo(env.KIE_API_KEY, row.provider_job_id);
  if (!info.ok) {
    return row;
  }

  if (info.state === "success" && info.resultUrl) {
    let resultUrl = info.resultUrl;
    if (hasMedia(env)) {
      try {
        const copied = await persistRemoteMedia(env.MEDIA, {
          userId: row.user_id,
          sourceUrl: info.resultUrl,
          origin,
        });
        if (copied) resultUrl = copied;
      } catch {
        // Keep provider URL if R2 copy fails
      }
    }
    await env.DB.prepare(
      "UPDATE generations SET status = 'done', result_url = ?, error_message = NULL WHERE id = ?"
    )
      .bind(resultUrl, row.id)
      .run();
    return { ...row, status: "done", result_url: resultUrl, error_message: null };
  }

  if (info.state === "fail") {
    const msg = info.failMsg || info.failCode || "provider generation failed";
    await env.DB.prepare(
      "UPDATE generations SET status = 'failed', error_message = ? WHERE id = ?"
    )
      .bind(msg, row.id)
      .run();
    return { ...row, status: "failed", error_message: msg };
  }

  return row;
}

function publicGeneration(row: GenerationRow) {
  const parsed = parseStoredModel(row.model);
  return {
    id: row.id,
    kind: parsed.kind,
    model: parsed.model,
    storedModel: row.model,
    prompt: row.prompt,
    status: row.status,
    media_key: row.media_key,
    duration_sec: row.duration_sec,
    input_image_url: row.input_image_url,
    provider_job_id: row.provider_job_id,
    result_url: row.result_url,
    resultUrl: row.result_url,
    error_message: row.error_message,
    created_at: row.created_at,
  };
}

/**
 * POST /api/generate
 * Body: { prompt, kind?: "video"|"image", imageUrl?, mediaKey?, model?, durationSec? }
 * Video requires imageUrl. Image is text-to-image, or image-to-image when imageUrl is set.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: {
    prompt?: string;
    kind?: string;
    model?: string;
    durationSec?: number;
    imageUrl?: string;
    image_url?: string;
    mediaKey?: string;
    media_key?: string;
  };
  try {
    body = await request.json();
  } catch {
    return error("invalid json");
  }

  const prompt = (body.prompt || "").trim();
  if (!prompt) return error("prompt required");
  if (prompt.length > 8000) return error("prompt too long");

  const kind: GenerationKind = body.kind === "image" ? "image" : "video";
  const imageUrl = (body.imageUrl || body.image_url || "").trim();

  if (kind === "video") {
    if (!imageUrl) {
      return structuredError(
        "image_url_required",
        "imageUrl is required for video. Upload a file via POST /api/upload or paste a public https image URL.",
        400,
        { mediaRequired: false }
      );
    }
  }
  if (imageUrl && !isPublicHttpsUrl(imageUrl)) {
    return structuredError(
      "image_url_invalid",
      "imageUrl must be a public https:// URL that KIE can fetch.",
      400
    );
  }

  const requestedKey = (body.mediaKey || body.media_key || "").trim();
  if (requestedKey && !isSafeMediaKey(requestedKey)) {
    return structuredError("media_key_invalid", "mediaKey is not a valid upload key.", 400);
  }
  const mediaKey = requestedKey || (imageUrl ? mediaKeyFromUrl(imageUrl) : null) || null;

  const model =
    kind === "image"
      ? IMAGE_COST[body.model || ""]
        ? (body.model as string)
        : "lite"
      : VIDEO_COST[body.model || ""]
        ? (body.model as string)
        : "lite";
  const cost = kind === "image" ? IMAGE_COST[model] : VIDEO_COST[model];
  const durationSec = kind === "image" ? null : Math.min(Math.max(Number(body.durationSec) || 5, 3), 15);
  const storedModel = storeModel(kind, model);
  const sound = kind === "video" && model === "pro";

  if (!hasDb(env) || !hasSessions(env)) {
    return structuredError(
      "bindings_missing",
      "backend not configured: missing DB and/or SESSIONS binding — see BACKEND.md. MEDIA/R2 is not required for generation.",
      503,
      { mediaRequired: false }
    );
  }

  if (!hasKieKey(env)) {
    return kieMissingResponse();
  }

  const token = tokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error("unauthorized", 401);

  // Atomic deduct: only succeeds when balance >= cost
  const deduct = await env.DB.prepare(
    "UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?"
  )
    .bind(cost, session.userId, cost)
    .run();

  if (!deduct.success || (deduct.meta.changes ?? 0) === 0) {
    const row = await env.DB.prepare("SELECT credits FROM users WHERE id = ?")
      .bind(session.userId)
      .first<{ credits: number }>();
    const credits = row ? Number(row.credits) : 0;
    return json({ error: "insufficient credits", credits }, 402);
  }

  // Create KIE task before D1 insert so we can refund cleanly on provider failure
  const created =
    kind === "image"
      ? await createImageTask(env.KIE_API_KEY, {
          prompt,
          imageUrl: imageUrl || null,
          resolution: model === "pro" ? "2K" : "1K",
        })
      : await createImageToVideoTask(env.KIE_API_KEY, {
          prompt,
          imageUrl,
          durationSec: durationSec || 5,
          sound,
        });

  if (!created.ok) {
    await refundCredits(env, session.userId, cost);
    const status =
      created.code === 401 || created.status === 401
        ? 502
        : created.code === 402
          ? 502
          : created.status >= 400 && created.status < 600
            ? 502
            : 502;
    return structuredError(
      "kie_create_failed",
      created.message || "Failed to create KIE generation task",
      status,
      { providerCode: created.code ?? null }
    );
  }

  let insert;
  try {
    insert = await env.DB.prepare(
      `INSERT INTO generations
        (user_id, model, prompt, status, media_key, duration_sec, input_image_url, provider_job_id, result_url, error_message)
       VALUES (?, ?, ?, 'processing', ?, ?, ?, ?, NULL, NULL)`
    )
      .bind(session.userId, storedModel, prompt, mediaKey, durationSec, imageUrl || null, created.taskId)
      .run();
  } catch (e) {
    await refundCredits(env, session.userId, cost);
    const msg = e instanceof Error ? e.message : "failed to create generation";
    // Common cause: migration 001 not applied yet
    if (/no such column/i.test(msg)) {
      return structuredError(
        "schema_migration_required",
        "D1 generations table is missing KIE columns. Run migrations/001_generations_kie.sql (see BACKEND.md).",
        503
      );
    }
    return structuredError("generation_insert_failed", msg, 500);
  }

  if (!insert.success) {
    await refundCredits(env, session.userId, cost);
    return error("failed to create generation", 500);
  }

  const generationId = Number(insert.meta.last_row_id);
  const bal = await env.DB.prepare("SELECT credits FROM users WHERE id = ?")
    .bind(session.userId)
    .first<{ credits: number }>();
  const credits = bal ? Number(bal.credits) : 0;

  return json({
    ok: true,
    demo: false,
    generationId,
    kind,
    model,
    cost,
    credits,
    status: "processing",
    providerJobId: created.taskId,
    imageUrl: imageUrl || null,
    mediaKey,
    resultUrl: null,
    mediaRequired: false,
    message:
      "KIE job created — poll GET /api/generate?id=" +
      generationId +
      " for status.",
  });
};

/**
 * GET /api/generate — history
 * GET /api/generate?id=N — single job; polls KIE when still processing
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasDb(env) || !hasSessions(env)) {
    return structuredError(
      "bindings_missing",
      "backend not configured: missing DB and/or SESSIONS binding — see BACKEND.md",
      503
    );
  }

  const token = tokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error("unauthorized", 401);

  const url = new URL(request.url);
  const idParam = url.searchParams.get("id");

  const origin = new URL(request.url).origin;

  if (idParam) {
    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) return error("invalid id");

    let row: GenerationRow | null;
    try {
      row = await env.DB.prepare(
        `SELECT id, user_id, model, prompt, status, media_key, duration_sec,
                input_image_url, provider_job_id, result_url, error_message, created_at
         FROM generations WHERE id = ? AND user_id = ?`
      )
        .bind(id, session.userId)
        .first<GenerationRow>();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/no such column/i.test(msg)) {
        return structuredError(
          "schema_migration_required",
          "D1 generations table is missing KIE columns. Run migrations/001_generations_kie.sql (see BACKEND.md).",
          503
        );
      }
      throw e;
    }

    if (!row) return error("not found", 404);

    if (row.status === "processing" && row.provider_job_id) {
      if (!hasKieKey(env)) {
        return kieMissingResponse();
      }
      row = await syncProviderStatus(env, row, origin);
    }

    return json({
      ok: true,
      demo: false,
      generation: publicGeneration(row),
      resultUrl: row.result_url,
      status: row.status,
    });
  }

  let rows;
  try {
    rows = await env.DB.prepare(
      `SELECT id, user_id, model, prompt, status, media_key, duration_sec,
              input_image_url, provider_job_id, result_url, error_message, created_at
       FROM generations WHERE user_id = ? ORDER BY id DESC LIMIT 50`
    )
      .bind(session.userId)
      .all<GenerationRow>();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/no such column/i.test(msg)) {
      return structuredError(
        "schema_migration_required",
        "D1 generations table is missing KIE columns. Run migrations/001_generations_kie.sql (see BACKEND.md).",
        503
      );
    }
    throw e;
  }

  const list = rows.results || [];
  // Best-effort sync a few in-flight jobs so history stays fresh
  if (hasKieKey(env)) {
    for (const g of list.filter((r) => r.status === "processing" && r.provider_job_id).slice(0, 3)) {
      await syncProviderStatus(env, g, origin);
    }
    const refreshed = await env.DB.prepare(
      `SELECT id, user_id, model, prompt, status, media_key, duration_sec,
              input_image_url, provider_job_id, result_url, error_message, created_at
       FROM generations WHERE user_id = ? ORDER BY id DESC LIMIT 50`
    )
      .bind(session.userId)
      .all<GenerationRow>();
    return json({
      ok: true,
      demo: false,
      generations: (refreshed.results || []).map(publicGeneration),
    });
  }

  return json({
    ok: true,
    demo: false,
    generations: list.map(publicGeneration),
  });
};
