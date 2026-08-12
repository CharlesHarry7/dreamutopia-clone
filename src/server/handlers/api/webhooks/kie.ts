import { json, hasDb, hasKieKey, hasSessions, type Env } from "@/server/libs/utils";
import { getTaskInfo } from "@/server/libs/kie";
import {
  extractKieTaskId,
  hasKieWebhookHmac,
  verifyKieWebhookSignature,
} from "@/server/libs/kieWebhook";
import {
  loadGenerationById,
  loadGenerationByProviderJob,
  lookupKieTask,
  settleAccountJob,
  settleGuestJob,
} from "@/server/libs/settle";
import { loadGuest, clientIp } from "@/server/libs/guest";

/**
 * POST /api/webhooks/kie — KIE Market callBackUrl.
 * Always re-fetches recordInfo (never trust the body for credits).
 * If Pages secret KIE_WEBHOOK_HMAC_KEY is set, require X-Webhook-Signature
 * (https://docs.kie.ai/common-api/webhook-verification).
 */
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!hasKieKey(env)) {
    return json({ error: "kie_api_key_missing" }, 503);
  }
  if (!hasSessions(env)) {
    return json({ error: "sessions_missing" }, 503);
  }

  const payload = await request.text();
  let body: unknown = {};
  try {
    body = JSON.parse(payload);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const taskId = extractKieTaskId(body);
  if (!taskId) return json({ error: "missing_task_id" }, 400);

  if (hasKieWebhookHmac(env)) {
    const verified = await verifyKieWebhookSignature({
      secret: env.KIE_WEBHOOK_HMAC_KEY,
      taskId,
      timestamp: request.headers.get("x-webhook-timestamp"),
      signature: request.headers.get("x-webhook-signature"),
    });
    if (!verified.ok) {
      return json({ error: verified.reason }, 401);
    }
  }

  const info = await getTaskInfo(env.KIE_API_KEY, taskId);
  if (!info.ok) {
    return json({ ok: false, error: "provider_lookup_failed", message: info.message }, 502);
  }
  if (info.state !== "success" && info.state !== "fail") {
    return json({ ok: true, ignored: info.state || "pending", taskId });
  }

  const origin = new URL(request.url).origin;
  const pointer = await lookupKieTask(env, taskId);

  if (pointer?.kind === "guest") {
    const rec = await loadGuest(env, pointer.guestId);
    const job = rec.jobs.find((j) => j.id === pointer.jobId);
    if (!job) return json({ ok: true, ignored: "guest_job_gone", taskId });
    const synced = await settleGuestJob(env, rec, job, origin, clientIp(request), info);
    return json({
      ok: true,
      guest: true,
      taskId,
      status: synced.job.status,
      providerState: synced.providerState,
    });
  }

  if (!hasDb(env)) {
    return json({ error: "db_missing" }, 503);
  }

  let row =
    pointer?.kind === "user"
      ? await loadGenerationById(env.DB, pointer.generationId, pointer.userId)
      : await loadGenerationByProviderJob(env.DB, taskId);

  if (!row && pointer?.kind === "user") {
    row = await loadGenerationByProviderJob(env.DB, taskId);
  }
  if (!row) {
    return json({ ok: true, ignored: "job_not_found", taskId });
  }

  const synced = await settleAccountJob(env, row, origin, info);
  return json({
    ok: true,
    guest: false,
    taskId,
    generationId: synced.row.id,
    status: synced.row.status,
    providerState: synced.providerState,
  });
};
