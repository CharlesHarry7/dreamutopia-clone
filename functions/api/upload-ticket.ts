import { json, error, preflight, asHead, hasMedia } from "../../libs/utils";
import { isSafeMediaKey, MAX_UPLOAD_BYTES } from "../../libs/media";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

function probe(env: Env, request: Request): Response {
  const raw = (new URL(request.url).searchParams.get("key") || "").trim();
  if (raw && !isSafeMediaKey(raw)) return error("invalid key", 400);

  return json({
    ok: true,
    ...(raw ? { key: raw } : {}),
    mediaBound: hasMedia(env),
    maxBytes: MAX_UPLOAD_BYTES,
    uploadPath: "/api/upload",
    mediaPath: "/api/media",
    note: hasMedia(env)
      ? "MEDIA R2 bound — POST /api/upload then use the returned imageUrl with /api/generate"
      : "MEDIA R2 not bound — /api/generate still accepts a public imageUrl",
    generateUsesMedia: hasMedia(env),
  });
}

/** GET /api/upload-ticket — legacy probe; real uploads are POST /api/upload */
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => probe(env, request);

export const onRequestHead: PagesFunction<Env> = async (ctx) => asHead(await onRequestGet(ctx));
