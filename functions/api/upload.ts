import {
  json,
  structuredError,
  preflight,
  hasSessions,
  hasMedia,
  bindingsUnavailable,
} from "../../libs/utils";
import { getSession, tokenFromRequest } from "../../libs/auth";
import {
  MAX_UPLOAD_BYTES,
  IMAGE_TYPES,
  extForContentType,
  publicMediaUrl,
  makeObjectKey,
} from "../../libs/media";
import {
  GUEST_USER_ID,
  ensureGuestId,
  guestHeaders,
  guestQuota,
  loadGuest,
  clientIp,
} from "../../libs/guest";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

/** GET /api/upload — capability probe for the workspace UI */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return json({
    ok: true,
    mediaBound: hasMedia(env),
    maxBytes: MAX_UPLOAD_BYTES,
    types: Object.keys(IMAGE_TYPES).filter((t) => t !== "image/jpg"),
    generateUsesMedia: hasMedia(env),
  });
};

/**
 * POST /api/upload
 * Signed-in users, or guests with remaining free trials.
 * Raw image body (Content-Type: image/jpeg|png|webp|gif).
 * Stores in R2 and returns a public HTTPS URL KIE can fetch.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasSessions(env)) return bindingsUnavailable("SESSIONS");
  if (!hasMedia(env)) {
    return structuredError(
      "media_not_bound",
      "MEDIA/R2 is not bound. Paste a public https image URL instead, or bind the dreamutopia-media bucket (see BACKEND.md).",
      503,
      { mediaBound: false, mediaRequired: false }
    );
  }

  const token = tokenFromRequest(request);
  const session = await getSession(env, token);
  const guestId = ensureGuestId(request);
  const extra = session ? undefined : guestHeaders(guestId, request);

  if (!session) {
    const rec = await loadGuest(env, guestId);
    const quota = await guestQuota(env, rec, clientIp(request));
    if (quota.blocked) {
      return json(
        {
          error: "guest_limit",
          code: "guest_limit",
          message: "Free trial used up — sign up to upload and generate.",
          guestRemaining: 0,
        },
        401,
        extra
      );
    }
  }

  const ownerId = session ? session.userId : GUEST_USER_ID;

  const contentType = request.headers.get("content-type") || "";
  const ext = extForContentType(contentType);
  if (!ext) {
    return structuredError(
      "unsupported_type",
      "Upload JPG, PNG, WebP, or GIF (Content-Type must be an image/* type).",
      415
    );
  }

  const declared = Number(request.headers.get("content-length") || "0");
  if (declared > MAX_UPLOAD_BYTES) {
    return structuredError(
      "file_too_large",
      "Image must be 10 MB or smaller.",
      413,
      { maxBytes: MAX_UPLOAD_BYTES }
    );
  }

  let buf: ArrayBuffer;
  try {
    buf = await request.arrayBuffer();
  } catch {
    return structuredError("upload_read_failed", "Could not read upload body.", 400);
  }

  if (buf.byteLength < 32) {
    return structuredError("file_empty", "Upload body is empty or too small.", 400);
  }
  if (buf.byteLength > MAX_UPLOAD_BYTES) {
    return structuredError(
      "file_too_large",
      "Image must be 10 MB or smaller.",
      413,
      { maxBytes: MAX_UPLOAD_BYTES }
    );
  }

  const key = makeObjectKey(ownerId, "img", ext);
  const type = contentType.split(";")[0].trim().toLowerCase();

  try {
    await env.MEDIA.put(key, buf, {
      httpMetadata: {
        contentType: type,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: { userId: String(ownerId) },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "R2 put failed";
    return structuredError("media_put_failed", msg, 502);
  }

  const imageUrl = publicMediaUrl(new URL(request.url).origin, key);
  return json(
    {
      ok: true,
      key,
      imageUrl,
      bytes: buf.byteLength,
      contentType: type,
      guest: !session,
    },
    200,
    extra
  );
};
