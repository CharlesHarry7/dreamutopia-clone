/**
 * Idempotent job settlement (pikbo-style capture/release, D1-sized).
 * Credits are deducted on create; a fail refunds once via
 * `UPDATE … WHERE status='processing'` plus `credit_events.reason = refund:gen:{id}`.
 */

import { costForStoredModel } from "./costs";
import { mediaKeyFromUrl, persistRemoteMedia } from "./media";
import { getTaskInfo, publicProviderFailMessage, type KieTaskInfo, type KieTaskError } from "./kie";
import {
  loadGuest,
  loadIpUsed,
  saveGuest,
  saveIpUsed,
  GUEST_USER_ID,
  type GuestJob,
  type GuestRecord,
} from "./guest";
import { hasMedia, type Env } from "./utils";

export type GenerationRow = {
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

export type KieTaskPointer =
  | { kind: "user"; userId: number; generationId: number }
  | { kind: "guest"; guestId: string; jobId: string };

const KIE_POINTER_TTL = 60 * 60 * 24 * 2;
const IDEMP_TTL = 60 * 60 * 24;

export async function persistResult(
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

export async function rememberKieTask(
  env: { SESSIONS: KVNamespace },
  taskId: string,
  pointer: KieTaskPointer
): Promise<void> {
  if (!taskId) return;
  await env.SESSIONS.put(`kie:${taskId}`, JSON.stringify(pointer), {
    expirationTtl: KIE_POINTER_TTL,
  });
}

export async function lookupKieTask(
  env: { SESSIONS: KVNamespace },
  taskId: string
): Promise<KieTaskPointer | null> {
  const raw = await env.SESSIONS.get(`kie:${taskId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as KieTaskPointer;
    if (parsed?.kind === "user" && parsed.generationId && parsed.userId) return parsed;
    if (parsed?.kind === "guest" && parsed.guestId && parsed.jobId) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function normalizeIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().slice(0, 128);
  if (t.length < 8) return null;
  return t;
}

export async function loadIdempotentGenerationId(
  env: { SESSIONS: KVNamespace },
  scope: string,
  key: string
): Promise<string | null> {
  return env.SESSIONS.get(`idem:${scope}:${key}`);
}

export async function saveIdempotentGenerationId(
  env: { SESSIONS: KVNamespace },
  scope: string,
  key: string,
  generationId: string | number
): Promise<void> {
  await env.SESSIONS.put(`idem:${scope}:${key}`, String(generationId), {
    expirationTtl: IDEMP_TTL,
  });
}

async function refundOnce(
  db: D1Database,
  userId: number,
  cost: number,
  generationId: number
): Promise<void> {
  if (cost <= 0) return;
  const reason = `refund:gen:${generationId}`;
  try {
    await db
      .prepare("INSERT INTO credit_events (user_id, delta, reason) VALUES (?, ?, ?)")
      .bind(userId, cost, reason)
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint failed/i.test(msg)) return;
    // Table/index missing — still refund via the status gate below.
  }
  await db
    .prepare("UPDATE users SET credits = credits + ? WHERE id = ?")
    .bind(cost, userId)
    .run();
}

export async function loadGenerationById(
  db: D1Database,
  id: number,
  userId?: number
): Promise<GenerationRow | null> {
  const sql = userId
    ? `SELECT id, user_id, model, prompt, status, media_key, duration_sec,
              input_image_url, provider_job_id, result_url, error_message, created_at
       FROM generations WHERE id = ? AND user_id = ?`
    : `SELECT id, user_id, model, prompt, status, media_key, duration_sec,
              input_image_url, provider_job_id, result_url, error_message, created_at
       FROM generations WHERE id = ?`;
  const stmt = userId ? db.prepare(sql).bind(id, userId) : db.prepare(sql).bind(id);
  return stmt.first<GenerationRow>();
}

export async function loadGenerationByProviderJob(
  db: D1Database,
  taskId: string
): Promise<GenerationRow | null> {
  return db
    .prepare(
      `SELECT id, user_id, model, prompt, status, media_key, duration_sec,
              input_image_url, provider_job_id, result_url, error_message, created_at
       FROM generations WHERE provider_job_id = ? ORDER BY id DESC LIMIT 1`
    )
    .bind(taskId)
    .first<GenerationRow>();
}

export async function settleAccountJob(
  env: Env & { DB: D1Database },
  row: GenerationRow,
  origin: string,
  prefetched?: KieTaskInfo | KieTaskError | null
): Promise<{ row: GenerationRow; providerState: string | null }> {
  if (row.status !== "processing" || !row.provider_job_id) {
    return {
      row,
      providerState: row.status === "done" ? "success" : row.status === "failed" ? "fail" : null,
    };
  }

  const apiKey = env.KIE_API_KEY;
  if (!apiKey) return { row, providerState: null };

  const info = prefetched || (await getTaskInfo(apiKey, row.provider_job_id));
  if (!info.ok) {
    return { row, providerState: null };
  }

  if (info.state === "success" && info.resultUrl) {
    const resultUrl = await persistResult(env, row.user_id, info.resultUrl, origin);
    const mediaKey = mediaKeyFromUrl(resultUrl);
    const upd = await env.DB.prepare(
      `UPDATE generations
         SET status = 'done', result_url = ?, media_key = COALESCE(?, media_key), error_message = NULL
       WHERE id = ? AND status = 'processing'`
    )
      .bind(resultUrl, mediaKey, row.id)
      .run();
    if ((upd.meta.changes ?? 0) === 0) {
      const fresh = await loadGenerationById(env.DB, row.id);
      return {
        row: fresh || {
          ...row,
          status: "done",
          result_url: resultUrl,
          media_key: mediaKey || row.media_key,
          error_message: null,
        },
        providerState: "success",
      };
    }
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
    const msg = publicProviderFailMessage(info.failMsg || info.failCode || "provider generation failed");
    const upd = await env.DB.prepare(
      "UPDATE generations SET status = 'failed', error_message = ? WHERE id = ? AND status = 'processing'"
    )
      .bind(msg, row.id)
      .run();
    if ((upd.meta.changes ?? 0) > 0) {
      const cost = costForStoredModel(row.model);
      if (cost) await refundOnce(env.DB, row.user_id, cost, row.id);
    }
    const fresh = (upd.meta.changes ?? 0) === 0 ? await loadGenerationById(env.DB, row.id) : null;
    return {
      row: fresh || { ...row, status: "failed", error_message: msg },
      providerState: "fail",
    };
  }

  return { row, providerState: info.state || "generating" };
}

export async function settleGuestJob(
  env: Env & { SESSIONS: KVNamespace },
  rec: GuestRecord,
  job: GuestJob,
  origin: string,
  ip: string | null,
  prefetched?: KieTaskInfo | KieTaskError | null
): Promise<{ job: GuestJob; providerState: string | null; rec: GuestRecord }> {
  if (job.status !== "processing" || !job.providerJobId) {
    return {
      job,
      rec,
      providerState: job.status === "done" ? "success" : job.status === "failed" ? "fail" : null,
    };
  }

  const apiKey = env.KIE_API_KEY;
  if (!apiKey) return { job, rec, providerState: null };

  const info = prefetched || (await getTaskInfo(apiKey, job.providerJobId));
  if (!info.ok) return { job, rec, providerState: null };

  const fresh = await loadGuest(env, rec.id);
  const current = fresh.jobs.find((j) => j.id === job.id);
  if (!current || current.status !== "processing") {
    return {
      job: current || job,
      rec: fresh,
      providerState:
        current?.status === "done" ? "success" : current?.status === "failed" ? "fail" : info.state || null,
    };
  }

  let next: GuestJob = current;
  if (info.state === "success" && info.resultUrl) {
    const resultUrl = await persistResult(env, GUEST_USER_ID, info.resultUrl, origin);
    next = { ...current, status: "done", resultUrl, errorMessage: null };
  } else if (info.state === "fail") {
    const msg = publicProviderFailMessage(info.failMsg || info.failCode || "provider generation failed");
    next = { ...current, status: "failed", errorMessage: msg };
    fresh.used = Math.max(0, fresh.used - 1);
    const ipUsed = await loadIpUsed(env, ip);
    await saveIpUsed(env, ip, Math.max(0, ipUsed - 1));
  } else {
    return { job: current, rec: fresh, providerState: info.state || "generating" };
  }

  fresh.jobs = fresh.jobs.map((j) => (j.id === job.id ? next : j));
  await saveGuest(env, fresh);
  return {
    job: next,
    rec: fresh,
    providerState: next.status === "done" ? "success" : "fail",
  };
}
