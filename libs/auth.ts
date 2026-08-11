// 会话管理 — KV 存储 session token
import { randomId } from "./utils";

const TTL = 60 * 60 * 24 * 30; // 30天

export interface Session {
  userId: number;
  email: string;
}

export async function createSession(env: { SESSIONS: KVNamespace }, userId: number, email: string): Promise<string> {
  const token = randomId("sess");
  await env.SESSIONS.put(token, JSON.stringify({ userId, email } satisfies Session), { expirationTtl: TTL });
  return token;
}

export async function getSession(env: { SESSIONS: KVNamespace }, token: string | null): Promise<Session | null> {
  if (!token) return null;
  const raw = await env.SESSIONS.get(token);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function destroySession(env: { SESSIONS: KVNamespace }, token: string | null): Promise<void> {
  if (token) await env.SESSIONS.delete(token);
}

// 从请求头提取 bearer token
export function tokenFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}
