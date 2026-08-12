// Session management — KV stores session token → { userId, email }
import { randomId, structuredError } from "./utils";

const TTL = 60 * 60 * 24 * 30; // 30 days

export interface Session {
  userId: number;
  email: string;
}

export async function createSession(
  env: { SESSIONS: KVNamespace },
  userId: number,
  email: string
): Promise<string> {
  const token = randomId("sess");
  await env.SESSIONS.put(token, JSON.stringify({ userId, email } satisfies Session), {
    expirationTtl: TTL,
  });
  return token;
}

export async function getSession(
  env: { SESSIONS: KVNamespace },
  token: string | null
): Promise<Session | null> {
  if (!token) return null;
  try {
    const raw = await env.SESSIONS.get(token);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export async function destroySession(
  env: { SESSIONS: KVNamespace },
  token: string | null
): Promise<void> {
  if (token) await env.SESSIONS.delete(token);
}

/** Bearer token from Authorization header */
export function tokenFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : "";
  return token || null;
}

/** Present Bearer that KV does not recognize — never fall through to guest. */
export function expiredSessionResponse(extra?: Record<string, unknown>): Response {
  return structuredError(
    "auth_required",
    "Session expired. Please log in again.",
    401,
    extra
  );
}

export async function getSessionUser(
  env: { SESSIONS?: KVNamespace },
  request: Request
): Promise<Session | null> {
  if (!env.SESSIONS) return null;
  return getSession(env as { SESSIONS: KVNamespace }, tokenFromRequest(request));
}
