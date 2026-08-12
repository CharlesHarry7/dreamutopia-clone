import { json, error, preflight, hasMedia } from "../../libs/utils";
import { MAX_UPLOAD_BYTES } from "../../libs/media";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

/** GET /api/upload-ticket — legacy probe; real uploads are POST /api/upload */
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return error("key required");

  return json({
    ok: true,
    key,
    mediaBound: hasMedia(env),
    maxBytes: MAX_UPLOAD_BYTES,
    uploadPath: "/api/upload",
    mediaPath: "/api/media",
    note: hasMedia(env)
      ? "MEDIA R2 bound — POST /api/upload then use the returned imageUrl with /api/generate"
      : "MEDIA R2 not bound — /api/generate still accepts a public imageUrl",
    generateUsesMedia: hasMedia(env),
  });
};
