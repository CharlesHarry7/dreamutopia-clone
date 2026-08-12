/** KV sliding-window counters (best-effort; slight overshoot under race is OK). */

export type RateLimitResult =
  | { ok: true; remaining: number; resetSec: number }
  | { ok: false; remaining: 0; resetSec: number; retryAfter: number };

export async function takeRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const raw = await kv.get(`rl:${key}`);
  let n = 0;
  let reset = now + windowSec;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { n?: number; reset?: number };
      n = Number(parsed.n) || 0;
      reset = Number(parsed.reset) || reset;
      if (reset <= now) {
        n = 0;
        reset = now + windowSec;
      }
    } catch {
      n = 0;
      reset = now + windowSec;
    }
  }
  n += 1;
  const ttl = Math.max(1, reset - now);
  await kv.put(`rl:${key}`, JSON.stringify({ n, reset }), { expirationTtl: ttl });
  if (n > limit) {
    return { ok: false, remaining: 0, resetSec: reset, retryAfter: ttl };
  }
  return { ok: true, remaining: Math.max(0, limit - n), resetSec: reset };
}

export function rateLimitedResponse(
  jsonFn: (data: unknown, status?: number, headers?: Record<string, string>) => Response,
  retryAfter: number
): Response {
  return jsonFn(
    {
      error: "rate_limited",
      code: "rate_limited",
      message: "Too many requests. Try again shortly.",
      retryAfter,
    },
    429,
    { "retry-after": String(retryAfter) }
  );
}
