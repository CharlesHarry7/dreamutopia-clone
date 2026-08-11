import { json, preflight } from "../../libs/utils";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

// GET /api/upload-ticket — 生成 R2 直传预签名 URL (demo: 返回空对象说明流程)
// 简化实现：直接返回媒体访问 URL 模板
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return json({ ok: false, error: "key required" });

  // R2 无内置预签名；demo 模式返回对象 key 供前端构造 URL
  return json({ ok: true, key, note: "demo — media served via /api/media/<key>" });
};
