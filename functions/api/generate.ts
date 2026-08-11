import { json, error, preflight, randomId } from "../../libs/utils";
import { getSession, tokenFromRequest } from "../../libs/auth";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// 模型价格表 (credits 每次生成)
const MODEL_COST: Record<string, number> = { lite: 3, medium: 5, pro: 16 };

// POST /api/generate  { prompt, model, durationSec?, startImageKey? }
// 创建生成任务并扣减额度
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const token = tokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error("unauthorized", 401);

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
  const durationSec = Math.min(Math.max(body.durationSec || 5, 3), 15);

  // 查余额并扣减 (事务)
  const tx = env.DB.batch([
    env.DB.prepare("SELECT credits FROM users WHERE id = ?").bind(session.userId),
    env.DB.prepare("INSERT INTO generations (user_id, model, prompt, status, duration_sec) VALUES (?, ?, ?, 'pending', ?)")
      .bind(session.userId, model, prompt, durationSec),
  ]);
  const [creditsRes, insertRes] = await tx;
  const credits = Number(creditsRes.results?.[0]?.credits ?? 0);
  if (credits < cost) return error("insufficient credits", 402);

  const generationId = Number(insertRes.meta.last_row_id);
  const mediaKey = randomId("media");

  // 扣减 + 标记处理中
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET credits = credits - ? WHERE id = ?").bind(cost, session.userId),
    env.DB.prepare("UPDATE generations SET status = 'processing', media_key = ? WHERE id = ?").bind(mediaKey, generationId),
  ]);

  return json({
    ok: true,
    generationId,
    model,
    cost,
    mediaKey,
    status: "processing",
    message: "generation queued — demo mode, media simulated",
  });
};

// GET /api/generate — 当前用户生成历史
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const token = tokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error("unauthorized", 401);

  const rows = await env.DB.prepare(
    "SELECT id, model, prompt, status, duration_sec, created_at FROM generations WHERE user_id = ? ORDER BY id DESC LIMIT 50"
  ).bind(session.userId).all();

  return json({ ok: true, generations: rows.results });
};
