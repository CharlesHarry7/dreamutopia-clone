import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Env } from "@/server/libs/utils";

/** Handler context for OpenNext-adapted API routes (same shape as former Pages Functions). */
export type HandlerContext = {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
  next?: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  params?: Record<string, string>;
  data?: unknown;
};

export type PagesHandler = (context: HandlerContext) => Response | Promise<Response>;

function asEnv(env: CloudflareEnv): Env {
  return env;
}

/**
 * Adapt a migrated Pages-style handler to a Next.js App Router route handler.
 * Bindings (D1/KV/R2/secrets) come from OpenNext's getCloudflareContext().
 */
export function adapt(handler: PagesHandler) {
  return async (request: Request): Promise<Response> => {
    const { env, ctx } = getCloudflareContext();
    return handler({
      request,
      env: asEnv(env),
      waitUntil: (p) => ctx.waitUntil(p),
    });
  };
}
