import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Env } from "@/server/libs/utils";

/** PagesFunction-compatible context for migrated handlers. */
export type HandlerContext = {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
  next?: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  params?: Record<string, string>;
  data?: unknown;
};

export type PagesHandler = (context: HandlerContext) => Response | Promise<Response>;

/**
 * Adapt a Cloudflare Pages Function handler to a Next.js App Router route handler.
 * Bindings (D1/KV/R2/secrets) come from OpenNext's getCloudflareContext().
 */
export function adapt(handler: PagesHandler) {
  return async (request: Request): Promise<Response> => {
    const { env, ctx } = getCloudflareContext();
    return handler({
      request,
      env: env as unknown as Env,
      waitUntil: (p) => ctx.waitUntil(p),
    });
  };
}

/** Direct env access for non-Pages-style code. */
export function getEnv(): Env {
  const { env } = getCloudflareContext();
  return env as unknown as Env;
}
