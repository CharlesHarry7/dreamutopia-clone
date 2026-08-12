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
  sniffImageExt,
  mimeForExt,
} from "../../libs/media";
import {
  GUEST_USER_ID,
  GUEST_UPLOAD_LIMIT,
  ensureGuestId,
  guestHeaders,
  guestQuota,
  loadGuest,
  saveGuest,
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
    types: Object.keys(IMAGE_TYPES).filter(
      (t) => t !== "image/jpg" && t !== "image/tif" && t !== "image/x-tiff"
    ),
    generateUsesMedia: hasMedia(env),
  });
};

/**
 * POST /api/upload
 * Signed-in users, or guests with remaining free trials.
 * Raw image body (Content-Type: image/jpeg|png|webp|gif|tiff).
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
  let guestRec = session ? null : await loadGuest(env, guestId);

  if (!session && guestRec) {
    const quota = await guestQuota(env, guestRec, clientIp(request));
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
    if (guestRec.uploads >= GUEST_UPLOAD_LIMIT) {
      return json(
        {
          error: "guest_upload_limit",
          code: "guest_upload_limit",
          message: "Too many guest uploads on this device. Sign up to continue.",
          guestRemaining: quota.remaining,
        },
        429,
        extra
      );
    }
  }

  const ownerId = session ? session.userId : GUEST_USER_ID;

  const contentType = request.headers.get("content-type") || "";
  const declaredExt = extForContentType(contentType);

  const declared = Number(request.headers.get("content-length") || "0");
  if (declared > MAX_UPLOAD_BYTES) {
    return structuredError(
      "file_too_large",
      "Image must be 20 MB or smaller.",
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
      "Image must be 20 MB or smaller.",
      413,
      { maxBytes: MAX_UPLOAD_BYTES }
    );
  }

  const sniffed = sniffImageExt(buf);
  const ext = sniffed || declaredExt;
  if (!ext) {
    return structuredError(
      "unsupported_type",
      "Upload JPG, PNG, WebP, GIF, or TIFF (Content-Type must be an image/* type).",
      415
    );
  }

  const key = makeObjectKey(ownerId, "img", ext);
  const type = mimeForExt(ext);

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

  if (guestRec) {
    guestRec.uploads += 1;
    await saveGuest(env, guestRec);
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
