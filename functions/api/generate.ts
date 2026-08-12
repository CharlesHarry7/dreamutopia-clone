import {
  json,
  error,
  structuredError,
  preflight,
  asHead,
  hasDb,
  hasSessions,
  hasKieKey,
  workerExceptionJson,
} from "../../libs/utils";
import { expiredSessionResponse, getSession, tokenFromRequest } from "../../libs/auth";
import {
  createImageToVideoTask,
  createTextToVideoTask,
  createFirstLastVideoTask,
  createImageTask,
  isPublicHttpsUrl,
  parseAspectRatio,
  parseImageResolution,
  publicProviderFailMessage,
  classifyProviderCreateError,
  kieImageUrlIssue,
  type AspectRatio,
  type ImageResolution,
} from "../../libs/kie";
import { kieCallbackUrl } from "../../libs/kieWebhook";
import { isSafeMediaKey, mediaKeyFromUrl } from "../../libs/media";
import { mergeGuestJobs } from "../../libs/account";
import { IMAGE_COST, VIDEO_COST, parseStoredModel, storeModel, type GenerationKind } from "../../libs/costs";
import { rateLimitedResponse, takeRateLimit } from "../../libs/rateLimit";
import {
  loadGenerationById,
  loadIdempotentGenerationId,
  normalizeIdempotencyKey,
  rememberKieTask,
  saveIdempotentGenerationId,
  settleAccountJob,
  settleGuestJob,
  type GenerationRow,
} from "../../libs/settle";
import {
  GUEST_LIMIT,
  ensureGuestId,
  guestHeaders,
  guestQuota,
  isGuestJobId,
  loadGuest,
  saveGuest,
  saveIpUsed,
  clientIp,
  remainingOf,
  type GuestJob,
} from "../../libs/guest";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

/**
 * HEAD /api/generate — liveness only.
 * Must not poll KIE (GET ?id= settles jobs and can hit an empty provider wallet).
 */
export const onRequestHead: PagesFunction<Env> = async ({ env }) => {
  if (!hasSessions(env)) {
    return asHead(
      structuredError(
        "bindings_missing",
        "backend not configured: missing SESSIONS binding — see BACKEND.md",
        503
      )
    );
  }
  return asHead(json({ ok: true, poll: false }));
};

const MAX_IN_FLIGHT = 3;

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

function kieMissingResponse(
  extra?: Record<string, unknown>,
  extraHeaders?: Record<string, string>
): Response {
  return structuredError(
    "kie_api_key_missing",
    "KIE_API_KEY is not configured. Set it as a Cloudflare Pages secret to enable generation.",
    503,
    { kieConfigured: false, mediaRequired: false, ...(extra || {}) },
    extraHeaders
  );
}

async function refundCredits(env: Env & { DB: D1Database }, userId: number, cost: number) {
  await env.DB.prepare("UPDATE users SET credits = credits + ? WHERE id = ?")
    .bind(cost, userId)
    .run();
}

function createdResponse(opts: {
  generationId: string | number;
  kind: GenerationKind;
  model: string;
  cost: number;
  credits: number | null;
  providerJobId: string;
  imageUrl: string | null;
  lastImageUrl: string | null;
  videoMode: string;
  mediaKey: string | null;
  guest: boolean;
  guestRemaining?: number;
  replay?: boolean;
}) {
  return {
    ok: true,
    demo: false,
    guest: opts.guest,
    generationId: opts.generationId,
    kind: opts.kind,
    model: opts.model,
    cost: opts.cost,
    credits: opts.credits,
    status: "processing",
    providerJobId: opts.providerJobId,
    imageUrl: opts.imageUrl,
    lastImageUrl: opts.lastImageUrl,
    videoMode: opts.videoMode,
    mediaKey: opts.mediaKey,
    resultUrl: null,
    mediaRequired: false,
    ...(opts.replay ? { idempotentReplay: true } : {}),
    ...(opts.guestRemaining !== undefined
      ? { guestRemaining: opts.guestRemaining, guestLimit: GUEST_LIMIT }
      : {}),
    message: "KIE job created — poll GET /api/generate?id=" + opts.generationId + " for status.",
  };
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
    error_message: row.error_message ? publicProviderFailMessage(row.error_message) : null,
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
    error_message: job.errorMessage ? publicProviderFailMessage(job.errorMessage) : null,
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
  idempotencyKey?: string;
  idempotency_key?: string;
};

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

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

function createFailedResponse(
  created: { message: string; code?: number | string; status: number },
  extra?: Record<string, unknown>,
  extraHeaders?: Record<string, string>
): Response {
  try {
    const codeNum = created.code == null || created.code === "" ? NaN : Number(created.code);
    const classified = classifyProviderCreateError(created);
    const providerCode = classified.providerCode ?? (Number.isFinite(codeNum) ? codeNum : null);
    const more = extra || {};
    const safe = classified.message || publicProviderFailMessage(created.message || "");
    if (classified.code === "kie_insufficient_balance") {
      return structuredError(
        "kie_insufficient_balance",
        safe,
        503,
        {
          providerCode,
          kieConfigured: true,
          provider_credits_insufficient: true,
          ...more,
        },
        extraHeaders
      );
    }
    if (classified.code === "kie_unauthorized") {
      return structuredError(
        "kie_unauthorized",
        "Generation provider rejected the API key. Check KIE_API_KEY.",
        503,
        { providerCode, kieConfigured: true, ...more },
        extraHeaders
      );
    }
    if (classified.code === "kie_file_type_unsupported") {
      return structuredError(
        "kie_file_type_unsupported",
        safe,
        400,
        { providerCode, ...more },
        extraHeaders
      );
    }
    return structuredError(
      "kie_create_failed",
      safe,
      classified.status || 502,
      { providerCode, ...more },
      extraHeaders
    );
  } catch {
    return workerExceptionJson("Generation failed. Please try again.");
  }
}

/**
 * POST /api/generate
 * Body: { prompt, kind?, imageUrl?, lastImageUrl?, imageUrls?, mediaKey?, model?, durationSec?, aspectRatio?, resolution? }
 * Guests (no session): 2 Lite image-to-video tries per device/IP.
 * Signed-in: T2V, I2V, first+last (Medium/Pro), image T2I/I2I/blend.
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    return await handleGeneratePost(ctx);
  } catch {
    try {
      return structuredError(
        "worker_exception",
        "Generation failed. Please try again.",
        500,
        { mediaRequired: false }
      );
    } catch {
      return workerExceptionJson("Generation failed. Please try again.");
    }
  }
};

async function handleGeneratePost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return error("invalid json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return error("invalid json");
  }
  const body = parsed as GenerateBody;

  const prompt = asTrimmed(body.prompt);
  if (!prompt) return error("prompt required");
  if (prompt.length > 8000) return error("prompt too long");

  const kind: GenerationKind = body.kind === "image" ? "image" : "video";
  const imageUrl = asTrimmed(body.imageUrl) || asTrimmed(body.image_url);
  const lastImageUrl = asTrimmed(body.lastImageUrl) || asTrimmed(body.last_image_url);
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
  if (imageUrl && kieImageUrlIssue(imageUrl)) {
    return structuredError(
      "kie_file_type_unsupported",
      "That image type isn’t supported. Use JPG, PNG, or WebP.",
      400,
      { field: "imageUrl" }
    );
  }
  if (lastImageUrl && kieImageUrlIssue(lastImageUrl)) {
    return structuredError(
      "kie_file_type_unsupported",
      "That image type isn’t supported. Use JPG, PNG, or WebP.",
      400,
      { field: "lastImageUrl" }
    );
  }
  for (const extra of extraUrls) {
    if (kieImageUrlIssue(extra)) {
      return structuredError(
        "kie_file_type_unsupported",
        "That image type isn’t supported. Use JPG, PNG, or WebP.",
        400,
        { field: "imageUrls" }
      );
    }
  }

  const requestedKey = asTrimmed(body.mediaKey) || asTrimmed(body.media_key);
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
  let session = null;
  try {
    session = await getSession(env, token);
  } catch {
    return structuredError(
      "generate_failed",
      "Generation failed. Please try again.",
      500,
      { mediaRequired: false }
    );
  }
  if (token && !session) {
    return expiredSessionResponse({ mediaRequired: false });
  }

  // Guest 4xx (image_url_required / guest_limit / lite-only) must not touch rate-limit KV.
  // A KV expirationTtl < 60 throw is Cloudflare 1101.
  // Guest no-image: never touch KV (live 1101 from RL TTL).
  if (!session && kind === "video" && model === "lite" && !imageUrl && !lastImageUrl) {
    return json(
      {
        error: "image_url_required",
        code: "image_url_required",
        message: "Free trial needs a start image. Upload a file or paste a public https URL.",
        mediaRequired: false,
        guestRemaining: GUEST_LIMIT,
        guestLimit: GUEST_LIMIT,
      },
      400
    );
  }
  if (!session) {
    const blocked = await guestRequestError(env, request, {
      kind,
      model,
      imageUrl,
      lastImageUrl,
    });
    if (blocked) return blocked;
  }

  const ip = clientIp(request);
  const rl = await takeRateLimit(
    env.SESSIONS,
    session ? `gen:u:${session.userId}` : `gen:ip:${ip || "unknown"}`,
    session ? 30 : 10,
    60
  );
  if (!rl.ok) return rateLimitedResponse(json, rl.retryAfter);

  const idempotencyKey = normalizeIdempotencyKey(
    body.idempotencyKey || body.idempotency_key || request.headers.get("idempotency-key")
  );

  if (!hasKieKey(env)) {
    if (!session) {
      try {
        const guestId = ensureGuestId(request);
        const rec = await loadGuest(env, guestId);
        const quota = await guestQuota(env, rec, clientIp(request));
        return kieMissingResponse(
          { guestRemaining: quota.remaining, guestLimit: GUEST_LIMIT },
          guestHeaders(guestId, request)
        );
      } catch {
        return kieMissingResponse({ guestRemaining: GUEST_LIMIT, guestLimit: GUEST_LIMIT });
      }
    }
    return kieMissingResponse();
  }

  if (!session) {
    try {
      return await handleGuestPost(env, request, {
        prompt,
        kind,
        model,
        imageUrl,
        lastImageUrl,
        durationSec: durationSec || 5,
        idempotencyKey,
      });
    } catch {
      return structuredError(
        "generate_failed",
        "Generation failed. Please try again.",
        500,
        { mediaRequired: false }
      );
    }
  }

  if (!hasDb(env)) {
    return structuredError(
      "bindings_missing",
      "backend not configured: missing DB binding — see BACKEND.md.",
      503,
      { mediaRequired: false }
    );
  }

  if (idempotencyKey) {
    const existingId = await loadIdempotentGenerationId(env, `u:${session.userId}`, idempotencyKey);
    const existingNum = existingId ? Number(existingId) : 0;
    if (existingNum > 0) {
      const existing = await loadGenerationById(env.DB, existingNum, session.userId);
      if (existing) {
        const parsed = parseStoredModel(existing.model);
        const images = decodeInputImages(existing.input_image_url);
        const bal = await env.DB.prepare("SELECT credits FROM users WHERE id = ?")
          .bind(session.userId)
          .first<{ credits: number }>();
        return json({
          ...createdResponse({
            generationId: existing.id,
            kind: parsed.kind,
            model: parsed.model,
            cost,
            credits: bal ? Number(bal.credits) : 0,
            providerJobId: existing.provider_job_id || "",
            imageUrl: images.first,
            lastImageUrl: images.last,
            videoMode: parsed.kind === "image" ? "image" : images.last ? "flf" : images.first ? "i2v" : "t2v",
            mediaKey: existing.media_key,
            guest: false,
            replay: true,
          }),
          status: existing.status,
          resultUrl: existing.result_url,
        });
      }
    }
  }

  const inFlight = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM generations WHERE user_id = ? AND status = 'processing'"
  )
    .bind(session.userId)
    .first<{ n: number }>();
  if (inFlight && Number(inFlight.n) >= MAX_IN_FLIGHT) {
    return structuredError(
      "job_in_flight",
      "You already have jobs rendering. Wait for one to finish.",
      429,
      { retryAfter: 15 }
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
    return structuredError(
      "insufficient_credits",
      "Not enough credits for this generation.",
      402,
      { credits, cost, mediaRequired: false }
    );
  }

  const callBackUrl = kieCallbackUrl(new URL(request.url).origin);
  const blendUrls = uniqueUrls([imageUrl || null], extraUrls);
  const created =
    kind === "image"
      ? await createImageTask(env.KIE_API_KEY, {
          prompt,
          imageUrls: blendUrls,
          resolution,
          callBackUrl,
        })
      : lastImageUrl
        ? await createFirstLastVideoTask(env.KIE_API_KEY, {
            prompt,
            firstUrl: imageUrl,
            lastUrl: lastImageUrl,
            durationSec: durationSec || 5,
            sound,
            mode: model === "pro" ? "pro" : "std",
            callBackUrl,
          })
        : imageUrl
          ? await createImageToVideoTask(env.KIE_API_KEY, {
              prompt,
              imageUrl,
              durationSec: durationSec || 5,
              sound,
              callBackUrl,
            })
          : await createTextToVideoTask(env.KIE_API_KEY, {
              prompt,
              durationSec: durationSec || 5,
              sound,
              aspectRatio,
              callBackUrl,
            });

  if (!created.ok) {
    await refundCredits(env, session.userId, cost);
    const bal = await env.DB.prepare("SELECT credits FROM users WHERE id = ?")
      .bind(session.userId)
      .first<{ credits: number }>();
    return createFailedResponse(created, {
      credits: bal ? Number(bal.credits) : 0,
      cost,
    });
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
  await rememberKieTask(env, created.taskId, {
    kind: "user",
    userId: session.userId,
    generationId,
  });
  if (idempotencyKey) {
    await saveIdempotentGenerationId(env, `u:${session.userId}`, idempotencyKey, generationId);
  }
  const bal = await env.DB.prepare("SELECT credits FROM users WHERE id = ?")
    .bind(session.userId)
    .first<{ credits: number }>();
  const credits = bal ? Number(bal.credits) : 0;
  const videoMode = kind === "image" ? "image" : lastImageUrl ? "flf" : imageUrl ? "i2v" : "t2v";

  return json(
    createdResponse({
      generationId,
      kind,
      model,
      cost,
      credits,
      providerJobId: created.taskId,
      imageUrl: imageUrl || null,
      lastImageUrl: lastImageUrl || null,
      videoMode,
      mediaKey,
      guest: false,
    })
  );
}

async function guestRequestError(
  env: Env & { SESSIONS: KVNamespace },
  request: Request,
  opts: { kind: GenerationKind; model: string; imageUrl: string; lastImageUrl: string }
): Promise<Response | null> {
  try {
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
  } catch {
    if (!opts.imageUrl) {
      return json(
        {
          error: "image_url_required",
          code: "image_url_required",
          message: "Free trial needs a start image. Upload a file or paste a public https URL.",
          mediaRequired: false,
          guestRemaining: GUEST_LIMIT,
          guestLimit: GUEST_LIMIT,
        },
        400
      );
    }
    return structuredError(
      "generate_failed",
      "Generation failed. Please try again.",
      500,
      { mediaRequired: false }
    );
  }
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
    idempotencyKey: string | null;
  }
): Promise<Response> {
  try {
    const guestId = ensureGuestId(request);
    const headers = guestHeaders(guestId, request);

    if (opts.idempotencyKey) {
    const existingId = await loadIdempotentGenerationId(env, `g:${guestId}`, opts.idempotencyKey);
    if (existingId) {
      const rec0 = await loadGuest(env, guestId);
      const job0 = rec0.jobs.find((j) => j.id === existingId);
      if (job0) {
        const quota0 = await guestQuota(env, rec0, clientIp(request));
        return json(
          {
            ...createdResponse({
              generationId: job0.id,
              kind: "video",
              model: "lite",
              cost: 0,
              credits: null,
              providerJobId: job0.providerJobId,
              imageUrl: job0.inputImageUrl,
              lastImageUrl: null,
              videoMode: "i2v",
              mediaKey: mediaKeyFromUrl(job0.inputImageUrl || ""),
              guest: true,
              guestRemaining: quota0.remaining,
              replay: true,
            }),
            status: job0.status,
            resultUrl: job0.resultUrl,
          },
          200,
          headers
        );
      }
    }
  }

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
    callBackUrl: kieCallbackUrl(new URL(request.url).origin),
  });
  if (!created.ok) {
    return createFailedResponse(
      created,
      { guestRemaining: quota.remaining, guestLimit: GUEST_LIMIT },
      headers
    );
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
  await rememberKieTask(env, created.taskId, { kind: "guest", guestId, jobId: job.id });
  if (opts.idempotencyKey) {
    await saveIdempotentGenerationId(env, `g:${guestId}`, opts.idempotencyKey, job.id);
  }

  return json(
    createdResponse({
      generationId: job.id,
      kind: "video",
      model: "lite",
      cost: 0,
      credits: null,
      providerJobId: created.taskId,
      imageUrl: opts.imageUrl,
      lastImageUrl: null,
      videoMode: "i2v",
      mediaKey: mediaKeyFromUrl(opts.imageUrl),
      guest: true,
      guestRemaining: remainingOf(rec.used),
    }),
    200,
    headers
  );
  } catch {
    return workerExceptionJson("Generation failed. Please try again.");
  }
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
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    return await handleGenerateGet(ctx);
  } catch {
    try {
      return structuredError(
        "worker_exception",
        "Could not load history. Please try again.",
        500
      );
    } catch {
      return workerExceptionJson("Could not load history. Please try again.");
    }
  }
};

async function handleGenerateGet({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!hasSessions(env)) {
    return structuredError(
      "bindings_missing",
      "backend not configured: missing SESSIONS binding — see BACKEND.md",
      503
    );
  }

  const token = tokenFromRequest(request);
  let session = null;
  try {
    session = await getSession(env, token);
  } catch {
    return structuredError("generate_failed", "Could not load history. Please try again.", 500);
  }
  if (token && !session) {
    return expiredSessionResponse();
  }
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return structuredError("generate_failed", "Could not load history. Please try again.", 500);
  }
  const idParam = url.searchParams.get("id");
  const origin = url.origin;

  if (!session) {
    try {
      return await handleGuestGet(env, request, idParam, origin);
    } catch {
      return structuredError("generate_failed", "Could not load history. Please try again.", 500);
    }
  }

  if (!hasDb(env)) {
    return structuredError(
      "bindings_missing",
      "backend not configured: missing DB binding — see BACKEND.md",
      503
    );
  }

  try {
    await mergeGuestJobs(env, request, session.userId);
  } catch {
    /* keep listing D1 history */
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
      return structuredError("generate_failed", "Could not load history. Please try again.", 500);
    }

    if (!row) return error("not found", 404);

    let providerState: string | null = null;
    if (row.status === "processing" && row.provider_job_id) {
      if (!hasKieKey(env)) {
        return kieMissingResponse();
      }
      try {
        const synced = await settleAccountJob(env, row, origin);
        row = synced.row;
        providerState = synced.providerState;
      } catch {
        /* return the D1 row even if KIE poll fails */
      }
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
    return structuredError("generate_failed", "Could not load history. Please try again.", 500);
  }

  const list = rows.results || [];
  if (hasKieKey(env)) {
    for (const g of list.filter((r) => r.status === "processing" && r.provider_job_id).slice(0, 3)) {
      try {
        await settleAccountJob(env, g, origin);
      } catch {
        /* keep listing even if one poll fails */
      }
    }
    try {
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
    } catch {
      /* fall through to the pre-settle list */
    }
  }

  return json({
    ok: true,
    demo: false,
    guest: false,
    generations: list.map(publicGeneration),
  });
}

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
      if (!hasKieKey(env)) {
        return kieMissingResponse(
          { guest: true, guestRemaining: quota.remaining, guestLimit: GUEST_LIMIT },
          headers
        );
      }
      try {
        const synced = await settleGuestJob(env, rec, job, origin, ip);
        job = synced.job;
        providerState = synced.providerState;
      } catch {
        /* return the stored job even if KIE poll fails */
      }
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
      try {
        await settleGuestJob(env, rec, j, origin, ip);
      } catch {
        /* keep listing even if one poll fails */
      }
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

/**
 * Pages on some deploys does not invoke onRequestHead / onRequestPost —
 * HEAD/POST then hit the SPA (HTML) or throw 1101. onRequest is the fallback.
 */
export const onRequest: PagesFunction<Env> = async (ctx) => {
  try {
    const method = ctx.request.method;
    if (method === "HEAD") return onRequestHead(ctx);
    if (method === "OPTIONS") return onRequestOptions();
    if (method === "GET") return onRequestGet(ctx);
    if (method === "POST") return onRequestPost(ctx);
    return structuredError("method_not_allowed", "Method not allowed.", 405);
  } catch {
    return workerExceptionJson("Request failed. Please try again.");
  }
};
