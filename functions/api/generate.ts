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
  createTextToVideoTask,
  createFirstLastVideoTask,
  createImageTask,
  getTaskInfo,
  isPublicHttpsUrl,
  parseAspectRatio,
  parseImageResolution,
  type AspectRatio,
  type ImageResolution,
} from "../../libs/kie";
import { isSafeMediaKey, mediaKeyFromUrl, persistRemoteMedia } from "../../libs/media";
import {
  GUEST_LIMIT,
  GUEST_USER_ID,
  ensureGuestId,
  guestHeaders,
  guestQuota,
  isGuestJobId,
  loadGuest,
  saveGuest,
  loadIpUsed,
  saveIpUsed,
  clientIp,
  remainingOf,
  type GuestJob,
  type GuestRecord,
} from "../../libs/guest";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

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

type InputImages = { first: string | null; last: string | null };

function encodeInputImages(first: string | null, last: string | null): string | null {
  if (first && last) return JSON.stringify({ first, last });
  return first || null;
}

function decodeInputImages(raw: string | null): InputImages {
  if (!raw) return { first: null, last: null };
  if (raw.startsWith("{")) {
    try {
      const o = JSON.parse(raw) as { first?: string; last?: string };
      return { first: o.first || null, last: o.last || null };
    } catch {
      return { first: raw, last: null };
    }
  }
  return { first: raw, last: null };
}

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

async function persistResult(
  env: Env,
  userId: number,
  sourceUrl: string,
  origin: string
): Promise<string> {
  if (!hasMedia(env)) return sourceUrl;
  try {
    const copied = await persistRemoteMedia(env.MEDIA, { userId, sourceUrl, origin });
    return copied || sourceUrl;
  } catch {
    return sourceUrl;
  }
}

async function syncProviderStatus(
  env: Env & { DB: D1Database; KIE_API_KEY: string },
  row: GenerationRow,
  origin: string
): Promise<{ row: GenerationRow; providerState: string | null }> {
  if (row.status !== "processing" || !row.provider_job_id) {
    return { row, providerState: row.status === "done" ? "success" : row.status === "failed" ? "fail" : null };
  }

  const info = await getTaskInfo(env.KIE_API_KEY, row.provider_job_id);
  if (!info.ok) {
    return { row, providerState: null };
  }

  if (info.state === "success" && info.resultUrl) {
    const resultUrl = await persistResult(env, row.user_id, info.resultUrl, origin);
    const mediaKey = mediaKeyFromUrl(resultUrl);
    await env.DB.prepare(
      "UPDATE generations SET status = 'done', result_url = ?, media_key = COALESCE(?, media_key), error_message = NULL WHERE id = ?"
    )
      .bind(resultUrl, mediaKey, row.id)
      .run();
    return {
      row: {
        ...row,
        status: "done",
        result_url: resultUrl,
        media_key: mediaKey || row.media_key,
        error_message: null,
      },
      providerState: "success",
    };
  }

  if (info.state === "fail") {
    const msg = info.failMsg || info.failCode || "provider generation failed";
    await env.DB.prepare(
      "UPDATE generations SET status = 'failed', error_message = ? WHERE id = ?"
    )
      .bind(msg, row.id)
      .run();
    const parsed = parseStoredModel(row.model);
    const cost = parsed.kind === "image" ? IMAGE_COST[parsed.model] : VIDEO_COST[parsed.model];
    if (cost) await refundCredits(env, row.user_id, cost);
    return { row: { ...row, status: "failed", error_message: msg }, providerState: "fail" };
  }

  return { row, providerState: info.state || "generating" };
}

function publicGeneration(row: GenerationRow) {
  const parsed = parseStoredModel(row.model);
  const images = decodeInputImages(row.input_image_url);
  const videoMode = parsed.kind === "image" ? "image" : images.last ? "flf" : images.first ? "i2v" : "t2v";
  return {
    id: row.id,
    kind: parsed.kind,
    model: parsed.model,
    storedModel: row.model,
    prompt: row.prompt,
    status: row.status,
    media_key: row.media_key,
    duration_sec: row.duration_sec,
    input_image_url: images.first,
    last_image_url: images.last,
    videoMode,
    provider_job_id: row.provider_job_id,
    result_url: row.result_url,
    resultUrl: row.result_url,
    error_message: row.error_message,
    created_at: row.created_at,
    guest: false,
  };
}

function publicGuestJob(job: GuestJob) {
  return {
    id: job.id,
    kind: job.kind,
    model: job.model,
    storedModel: job.model,
    prompt: job.prompt,
    status: job.status,
    media_key: null,
    duration_sec: 5,
    input_image_url: job.inputImageUrl,
    last_image_url: null,
    videoMode: "i2v",
    provider_job_id: job.providerJobId,
    result_url: job.resultUrl,
    resultUrl: job.resultUrl,
    error_message: job.errorMessage,
    created_at: job.createdAt,
    guest: true,
  };
}

type GenerateBody = {
  prompt?: string;
  kind?: string;
  model?: string;
  durationSec?: number;
  aspectRatio?: string;
  resolution?: string;
  imageUrl?: string;
  image_url?: string;
  lastImageUrl?: string;
  last_image_url?: string;
  imageUrls?: unknown;
  image_urls?: unknown;
  mediaKey?: string;
  media_key?: string;
};

function collectHttpsUrls(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (s && isPublicHttpsUrl(s) && !out.includes(s)) out.push(s);
  }
  return out;
}

function uniqueUrls(...lists: (string | null | undefined)[][]): string[] {
  const out: string[] = [];
  for (const list of lists) {
    for (const v of list) {
      if (v && !out.includes(v)) out.push(v);
    }
  }
  return out;
}

async function syncGuestJob(
  env: Env & { SESSIONS: KVNamespace; KIE_API_KEY: string },
  rec: GuestRecord,
  job: GuestJob,
  origin: string,
  ip: string | null
): Promise<{ job: GuestJob; providerState: string | null }> {
  if (job.status !== "processing" || !job.providerJobId) {
    return { job, providerState: job.status === "done" ? "success" : job.status === "failed" ? "fail" : null };
  }
  const info = await getTaskInfo(env.KIE_API_KEY, job.providerJobId);
  if (!info.ok) return { job, providerState: null };

  let next = job;
  if (info.state === "success" && info.resultUrl) {
    const resultUrl = await persistResult(env, GUEST_USER_ID, info.resultUrl, origin);
    next = { ...job, status: "done", resultUrl, errorMessage: null };
  } else if (info.state === "fail") {
    const msg = info.failMsg || info.failCode || "provider generation failed";
    next = { ...job, status: "failed", errorMessage: msg };
    rec.used = Math.max(0, rec.used - 1);
    const ipUsed = await loadIpUsed(env, ip);
    await saveIpUsed(env, ip, Math.max(0, ipUsed - 1));
  } else {
    return { job, providerState: info.state || "generating" };
  }

  rec.jobs = rec.jobs.map((j) => (j.id === job.id ? next : j));
  await saveGuest(env, rec);
  return { job: next, providerState: next.status === "done" ? "success" : "fail" };
}

function createFailedResponse(
  created: { message: string; code?: number; status: number }
): Response {
  const status =
    created.code === 401 || created.status === 401
      ? 502
      : created.code === 402
        ? 502
        : 502;
  return structuredError(
    "kie_create_failed",
    created.message || "Failed to create KIE generation task",
    status,
    { providerCode: created.code ?? null }
  );
}

/**
 * POST /api/generate
 * Body: { prompt, kind?, imageUrl?, lastImageUrl?, imageUrls?, mediaKey?, model?, durationSec?, aspectRatio?, resolution? }
 * Guests (no session): 2 Lite image-to-video tries per device/IP.
 * Signed-in: T2V, I2V, first+last (Medium/Pro), image T2I/I2I/blend.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: GenerateBody;
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
  const lastImageUrl = (body.lastImageUrl || body.last_image_url || "").trim();
  const extraUrls = collectHttpsUrls(body.imageUrls || body.image_urls);

  if (imageUrl && !isPublicHttpsUrl(imageUrl)) {
    return structuredError(
      "image_url_invalid",
      "imageUrl must be a public https:// URL that KIE can fetch.",
      400
    );
  }
  if (lastImageUrl && !isPublicHttpsUrl(lastImageUrl)) {
    return structuredError(
      "last_image_url_invalid",
      "lastImageUrl must be a public https:// URL that KIE can fetch.",
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
  const aspectRatio: AspectRatio = parseAspectRatio(body.aspectRatio);
  const resolution: ImageResolution = parseImageResolution(
    body.resolution,
    model === "pro" ? "2K" : "1K"
  );
  const storedModel = storeModel(kind, model);
  const sound = kind === "video" && model === "pro";

  if (kind === "video" && lastImageUrl) {
    if (!imageUrl) {
      return structuredError(
        "image_url_required",
        "First-and-last-frame video needs both imageUrl and lastImageUrl.",
        400
      );
    }
    if (model === "lite") {
      return structuredError(
        "first_last_requires_medium",
        "First + last frame is available on Medium and Pro.",
        400
      );
    }
  }

  if (!hasSessions(env)) {
    return structuredError(
      "bindings_missing",
      "backend not configured: missing SESSIONS binding — see BACKEND.md.",
      503,
      { mediaRequired: false }
    );
  }

  const token = tokenFromRequest(request);
  const session = await getSession(env, token);

  if (!session) {
    const blocked = await guestRequestError(env, request, {
      kind,
      model,
      imageUrl,
      lastImageUrl,
    });
    if (blocked) return blocked;
  }

  if (!hasKieKey(env)) {
    return kieMissingResponse();
  }

  if (!session) {
    return handleGuestPost(env, request, {
      prompt,
      kind,
      model,
      imageUrl,
      lastImageUrl,
      durationSec: durationSec || 5,
    });
  }

  if (!hasDb(env)) {
    return structuredError(
      "bindings_missing",
      "backend not configured: missing DB binding — see BACKEND.md.",
      503,
      { mediaRequired: false }
    );
  }

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

  const blendUrls = uniqueUrls([imageUrl || null], extraUrls);
  const created =
    kind === "image"
      ? await createImageTask(env.KIE_API_KEY, {
          prompt,
          imageUrls: blendUrls,
          resolution,
        })
      : lastImageUrl
        ? await createFirstLastVideoTask(env.KIE_API_KEY, {
            prompt,
            firstUrl: imageUrl,
            lastUrl: lastImageUrl,
            durationSec: durationSec || 5,
            sound,
            mode: model === "pro" ? "pro" : "std",
          })
        : imageUrl
          ? await createImageToVideoTask(env.KIE_API_KEY, {
              prompt,
              imageUrl,
              durationSec: durationSec || 5,
              sound,
            })
          : await createTextToVideoTask(env.KIE_API_KEY, {
              prompt,
              durationSec: durationSec || 5,
              sound,
              aspectRatio,
            });

  if (!created.ok) {
    await refundCredits(env, session.userId, cost);
    return createFailedResponse(created);
  }

  const storedInput = encodeInputImages(imageUrl || null, lastImageUrl || null);

  let insert;
  try {
    insert = await env.DB.prepare(
      `INSERT INTO generations
        (user_id, model, prompt, status, media_key, duration_sec, input_image_url, provider_job_id, result_url, error_message)
       VALUES (?, ?, ?, 'processing', ?, ?, ?, ?, NULL, NULL)`
    )
      .bind(session.userId, storedModel, prompt, mediaKey, durationSec, storedInput, created.taskId)
      .run();
  } catch (e) {
    await refundCredits(env, session.userId, cost);
    const msg = e instanceof Error ? e.message : "failed to create generation";
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
  const videoMode = kind === "image" ? "image" : lastImageUrl ? "flf" : imageUrl ? "i2v" : "t2v";

  return json({
    ok: true,
    demo: false,
    guest: false,
    generationId,
    kind,
    model,
    cost,
    credits,
    status: "processing",
    providerJobId: created.taskId,
    imageUrl: imageUrl || null,
    lastImageUrl: lastImageUrl || null,
    videoMode,
    mediaKey,
    resultUrl: null,
    mediaRequired: false,
    message: "KIE job created — poll GET /api/generate?id=" + generationId + " for status.",
  });
};

async function guestRequestError(
  env: Env & { SESSIONS: KVNamespace },
  request: Request,
  opts: { kind: GenerationKind; model: string; imageUrl: string; lastImageUrl: string }
): Promise<Response | null> {
  const guestId = ensureGuestId(request);
  const headers = guestHeaders(guestId, request);
  const rec = await loadGuest(env, guestId);
  const quota = await guestQuota(env, rec, clientIp(request));
  if (opts.kind !== "video" || opts.model !== "lite") {
    return json(
      {
        error: "guest_lite_only",
        code: "guest_lite_only",
        message: "Free trial is Lite image-to-video only. Sign up for 10 credits and every model.",
        guestRemaining: quota.remaining,
        guestLimit: GUEST_LIMIT,
      },
      401,
      headers
    );
  }
  if (opts.lastImageUrl) {
    return json(
      {
        error: "first_last_requires_medium",
        code: "first_last_requires_medium",
        message: "First + last frame needs a free account (Medium or Pro).",
        guestRemaining: quota.remaining,
        guestLimit: GUEST_LIMIT,
      },
      401,
      headers
    );
  }
  if (!opts.imageUrl) {
    return json(
      {
        error: "image_url_required",
        code: "image_url_required",
        message: "Free trial needs a start image. Upload a file or paste a public https URL.",
        mediaRequired: false,
        guestRemaining: quota.remaining,
        guestLimit: GUEST_LIMIT,
      },
      400,
      headers
    );
  }
  if (quota.blocked) {
    return json(
      {
        error: "guest_limit",
        code: "guest_limit",
        message: "You used both free Lite videos on this device. Sign up for 10 credits.",
        guestRemaining: 0,
        guestLimit: GUEST_LIMIT,
      },
      402,
      headers
    );
  }
  return null;
}

async function handleGuestPost(
  env: Env & { SESSIONS: KVNamespace; KIE_API_KEY: string },
  request: Request,
  opts: {
    prompt: string;
    kind: GenerationKind;
    model: string;
    imageUrl: string;
    lastImageUrl: string;
    durationSec: number;
  }
): Promise<Response> {
  const guestId = ensureGuestId(request);
  const headers = guestHeaders(guestId, request);

  const rec = await loadGuest(env, guestId);
  const ip = clientIp(request);
  const quota = await guestQuota(env, rec, ip);
  if (quota.blocked) {
    return json(
      {
        error: "guest_limit",
        code: "guest_limit",
        message: "You used both free Lite videos on this device. Sign up for 10 credits.",
        guestRemaining: 0,
        guestLimit: GUEST_LIMIT,
      },
      402,
      headers
    );
  }

  const created = await createImageToVideoTask(env.KIE_API_KEY, {
    prompt: opts.prompt,
    imageUrl: opts.imageUrl,
    durationSec: 5,
    sound: false,
  });
  if (!created.ok) {
    return createFailedResponse(created);
  }

  const job: GuestJob = {
    id: randomGuestJobId(),
    providerJobId: created.taskId,
    prompt: opts.prompt,
    kind: "video",
    model: "lite",
    status: "processing",
    inputImageUrl: opts.imageUrl,
    resultUrl: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
  };
  rec.used = quota.used + 1;
  rec.jobs.unshift(job);
  await saveGuest(env, rec);
  await saveIpUsed(env, ip, rec.used);

  return json(
    {
      ok: true,
      demo: false,
      guest: true,
      generationId: job.id,
      kind: "video",
      model: "lite",
      cost: 0,
      credits: null,
      guestRemaining: remainingOf(rec.used),
      guestLimit: GUEST_LIMIT,
      status: "processing",
      providerJobId: created.taskId,
      imageUrl: opts.imageUrl,
      lastImageUrl: null,
      videoMode: "i2v",
      mediaKey: mediaKeyFromUrl(opts.imageUrl),
      resultUrl: null,
      mediaRequired: false,
      message: "KIE job created — poll GET /api/generate?id=" + job.id + " for status.",
    },
    200,
    headers
  );
}

function randomGuestJobId(): string {
  const rand = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
  return `g_${hex}`;
}

/**
 * GET /api/generate — history (account or this device's guest jobs)
 * GET /api/generate?id=N — single job; polls KIE when still processing
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasSessions(env)) {
    return structuredError(
      "bindings_missing",
      "backend not configured: missing SESSIONS binding — see BACKEND.md",
      503
    );
  }

  const token = tokenFromRequest(request);
  const session = await getSession(env, token);
  const url = new URL(request.url);
  const idParam = url.searchParams.get("id");
  const origin = url.origin;

  if (!session) {
    return handleGuestGet(env, request, idParam, origin);
  }

  if (!hasDb(env)) {
    return structuredError(
      "bindings_missing",
      "backend not configured: missing DB binding — see BACKEND.md",
      503
    );
  }

  if (idParam) {
    if (isGuestJobId(idParam)) {
      return handleGuestGet(env, request, idParam, origin);
    }
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

    let providerState: string | null = null;
    if (row.status === "processing" && row.provider_job_id) {
      if (!hasKieKey(env)) {
        return kieMissingResponse();
      }
      const synced = await syncProviderStatus(env, row, origin);
      row = synced.row;
      providerState = synced.providerState;
    }

    return json({
      ok: true,
      demo: false,
      generation: publicGeneration(row),
      resultUrl: row.result_url,
      status: row.status,
      providerState,
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
      guest: false,
      generations: (refreshed.results || []).map(publicGeneration),
    });
  }

  return json({
    ok: true,
    demo: false,
    guest: false,
    generations: list.map(publicGeneration),
  });
};

async function handleGuestGet(
  env: Env & { SESSIONS: KVNamespace },
  request: Request,
  idParam: string | null,
  origin: string
): Promise<Response> {
  const guestId = ensureGuestId(request);
  const headers = guestHeaders(guestId, request);
  const rec = await loadGuest(env, guestId);
  const ip = clientIp(request);
  const quota = await guestQuota(env, rec, ip);

  if (idParam) {
    if (!isGuestJobId(idParam)) {
      return json({ error: "unauthorized", code: "unauthorized" }, 401, headers);
    }
    let job = rec.jobs.find((j) => j.id === idParam) || null;
    if (!job) return json({ error: "not found", code: "not_found" }, 404, headers);
    let providerState: string | null = null;
    if (job.status === "processing" && job.providerJobId) {
      if (!hasKieKey(env)) return kieMissingResponse();
      const synced = await syncGuestJob(env, rec, job, origin, ip);
      job = synced.job;
      providerState = synced.providerState;
    }
    return json(
      {
        ok: true,
        demo: false,
        guest: true,
        generation: publicGuestJob(job),
        resultUrl: job.resultUrl,
        status: job.status,
        providerState,
        guestRemaining: quota.remaining,
        guestLimit: GUEST_LIMIT,
      },
      200,
      headers
    );
  }

  if (hasKieKey(env)) {
    for (const j of rec.jobs.filter((x) => x.status === "processing" && x.providerJobId).slice(0, 3)) {
      await syncGuestJob(env, rec, j, origin, ip);
    }
  }
  const fresh = await loadGuest(env, guestId);
  const q2 = await guestQuota(env, fresh, ip);
  return json(
    {
      ok: true,
      demo: false,
      guest: true,
      guestRemaining: q2.remaining,
      guestLimit: GUEST_LIMIT,
      generations: fresh.jobs.map(publicGuestJob),
    },
    200,
    headers
  );
}
