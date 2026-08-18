import { error, preflight, hasMedia } from "@/server/libs/utils";
import { isSafeMediaKey } from "@/server/libs/media";
import type { Env } from "@/server/libs/utils";

export const onRequestOptions = (): Response => preflight();

function keyFromRequest(request: Request): string | null {
  const key = new URL(request.url).searchParams.get("key") || "";
  return isSafeMediaKey(key) ? key : null;
}

function objectHeaders(object: R2Object): Headers {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");
  return headers;
}

/** HEAD /api/media?key= — metadata only (KIE / caches) */
export const onRequestHead: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasMedia(env)) return error("media not bound", 503);
  const key = keyFromRequest(request);
  if (!key) return error("invalid key", 400);
  const object = await env.MEDIA.head(key);
  if (!object) return error("not found", 404);
  return new Response(null, { status: 200, headers: objectHeaders(object) });
};

/**
 * GET /api/media?key= — public image bytes for KIE + the workspace preview.
 * Auth is intentionally omitted: the key is unguessable.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasMedia(env)) return error("media not bound", 503);
  const key = keyFromRequest(request);
  if (!key) return error("invalid key", 400);

  const object = await env.MEDIA.get(key);
  if (!object) return error("not found", 404);

  return new Response(object.body, { headers: objectHeaders(object) });
};
