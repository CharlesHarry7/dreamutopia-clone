import {
  json,
  error,
  preflight,
  randomId,
  hasDb,
  hasSessions,
} from "../../libs/utils";
import { getSession, tokenFromRequest } from "../../libs/auth";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// Credits per generation
const MODEL_COST: Record<string, number> = { lite: 3, medium: 5, pro: 16 };

/** Demo response when D1/KV are not bound — no credit deduction */
function demoGenerate(prompt: string, model: string, durationSec: number, cost: number) {
  const generationId = Date.now();
  const mediaKey = randomId("media");
  return json({
    ok: true,
    demo: true,
    generationId,
    model,
    cost,
    credits: null,
    mediaKey,
    status: "processing",
    message: "demo mode — DB/KV not bound; credits not deducted (see BACKEND.md)",
    prompt: prompt.slice(0, 200),
    durationSec,
  });
}

// POST /api/generate  { prompt, model, durationSec? }
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { prompt?: string; model?: string; durationSec?: number };
  try {
    body = await request.json();
  } catch {
    return error("invalid json");
  }

  const prompt = (body.prompt || "").trim();
  if (!prompt) return error("prompt required");
  if (prompt.length > 8000) return error("prompt too long");

  const model = body.model && MODEL_COST[body.model] ? body.model : "lite";
  const cost = MODEL_COST[model];
  const durationSec = Math.min(Math.max(Number(body.durationSec) || 5, 3), 15);

  // Graceful demo when bindings missing
  if (!hasDb(env) || !hasSessions(env)) {
    return demoGenerate(prompt, model, durationSec, cost);
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

  const mediaKey = randomId("media");
  let insert;
  try {
    insert = await env.DB.prepare(
      "INSERT INTO generations (user_id, model, prompt, status, media_key, duration_sec) VALUES (?, ?, ?, 'processing', ?, ?)"
    )
      .bind(session.userId, model, prompt, mediaKey, durationSec)
      .run();
  } catch {
    // Best-effort refund if generation row insert fails after deduct
    await env.DB.prepare("UPDATE users SET credits = credits + ? WHERE id = ?")
      .bind(cost, session.userId)
      .run();
    return error("failed to create generation", 500);
  }

  if (!insert.success) {
    await env.DB.prepare("UPDATE users SET credits = credits + ? WHERE id = ?")
      .bind(cost, session.userId)
      .run();
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
    model,
    cost,
    credits,
    mediaKey,
    status: "processing",
    message: "generation queued — demo inference, media simulated",
  });
};

// GET /api/generate — current user history
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasDb(env) || !hasSessions(env)) {
    return json({ ok: true, demo: true, generations: [] });
  }

  const token = tokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error("unauthorized", 401);

  const rows = await env.DB.prepare(
    "SELECT id, model, prompt, status, media_key, duration_sec, created_at FROM generations WHERE user_id = ? ORDER BY id DESC LIMIT 50"
  )
    .bind(session.userId)
    .all();

  return json({ ok: true, demo: false, generations: rows.results || [] });
};
