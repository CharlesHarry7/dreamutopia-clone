// 环境类型定义
export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  MEDIA: R2Bucket;
}

// 通用响应
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization",
    },
  });
}

export function error(msg: string, status = 400): Response {
  return json({ error: msg }, status);
}

// OPTIONS 预检
export function preflight(): Response {
  return new Response(null, { status: 204 });
}

// 生成随机 ID
export function randomId(prefix = "gen"): string {
  const rand = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}
