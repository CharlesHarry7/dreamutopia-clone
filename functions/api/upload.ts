import {
  json,
  structuredError,
  preflight,
  asHead,
  hasSessions,
  hasMedia,
  bindingsUnavailable,
} from "../../libs/utils";
import { expiredSessionResponse, getSession, tokenFromRequest } from "../../libs/auth";
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
  GUEST_LIMIT,
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
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const base = {
    ok: true,
    mediaBound: hasMedia(env),
    maxBytes: MAX_UPLOAD_BYTES,
    types: Object.keys(IMAGE_TYPES).filter(
      (t) => t !== "image/jpg" && t !== "image/tif" && t !== "image/x-tiff"
    ),
    generateUsesMedia: hasMedia(env),
    guestUploadLimit: GUEST_UPLOAD_LIMIT,
  };

  if (!hasSessions(env)) return json(base);

  const token = tokenFromRequest(request);
  const session = await getSession(env, token);
  if (session) return json({ ...base, guest: false });

  const guestId = ensureGuestId(request);
  const rec = await loadGuest(env, guestId);
  const quota = await guestQuota(env, rec, clientIp(request));
  return json(
    {
      ...base,
      guest: true,
      guestRemaining: quota.remaining,
      guestLimit: GUEST_LIMIT,
      guestUploads: rec.uploads,
    },
    200,
    guestHeaders(guestId, request)
  );
};

export const onRequestHead: PagesFunction<Env> = async (ctx) => asHead(await onRequestGet(ctx));

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
  if (token && !session) return expiredSessionResponse();
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
        402,
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
  const quotaAfter =
    !session && guestRec ? await guestQuota(env, guestRec, clientIp(request)) : null;
  return json(
    {
      ok: true,
      key,
      imageUrl,
      bytes: buf.byteLength,
      contentType: type,
      guest: !session,
      ...(quotaAfter
        ? {
            guestRemaining: quotaAfter.remaining,
            guestLimit: GUEST_LIMIT,
            guestUploads: guestRec ? guestRec.uploads : 0,
            guestUploadLimit: GUEST_UPLOAD_LIMIT,
          }
        : {}),
    },
    200,
    extra
  );
};
