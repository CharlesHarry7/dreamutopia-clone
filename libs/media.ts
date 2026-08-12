/** R2 object-key helpers — keys are unguessable and safe as query params. */

import { randomId } from "./utils";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_RESULT_BYTES = 40 * 1024 * 1024;

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/tiff": "tif",
  "image/tif": "tif",
  "image/x-tiff": "tif",
};

const RESULT_TYPES: Record<string, string> = {
  ...IMAGE_TYPES,
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mp4",
};

const MEDIA_KEY_RE = /^[0-9]+_(img|out)_[a-f0-9]{16}\.(jpg|png|webp|gif|tif|mp4|webm)$/;

export function isSafeMediaKey(key: string): boolean {
  return MEDIA_KEY_RE.test(key);
}

export function extForContentType(contentType: string): string | null {
  const ct = contentType.split(";")[0].trim().toLowerCase();
  return IMAGE_TYPES[ct] || null;
}

export function extForResultType(contentType: string, sourceUrl?: string): string | null {
  const ct = contentType.split(";")[0].trim().toLowerCase();
  if (RESULT_TYPES[ct]) return RESULT_TYPES[ct];
  if (!sourceUrl) return null;
  try {
    const path = new URL(sourceUrl).pathname.toLowerCase();
    const m = path.match(/\.(jpg|jpeg|png|webp|gif|tiff?|mp4|webm)$/);
    if (!m) return null;
    if (m[1] === "jpeg") return "jpg";
    if (m[1] === "tiff") return "tif";
    return m[1];
  } catch {
    return null;
  }
}

export function mimeForExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    tif: "image/tiff",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  return map[ext] || "application/octet-stream";
}

/** Magic-byte sniff so TIFF / mislabeled uploads still work. */
export function sniffImageExt(buf: ArrayBuffer): string | null {
  const u = new Uint8Array(buf);
  if (u.length < 12) return null;
  if (u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return "jpg";
  if (u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return "png";
  if (u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46) return "gif";
  if (
    u[0] === 0x52 &&
    u[1] === 0x49 &&
    u[2] === 0x46 &&
    u[3] === 0x46 &&
    u[8] === 0x57 &&
    u[9] === 0x45 &&
    u[10] === 0x42 &&
    u[11] === 0x50
  ) {
    return "webp";
  }
  if (
    (u[0] === 0x49 && u[1] === 0x49 && u[2] === 0x2a && u[3] === 0x00) ||
    (u[0] === 0x4d && u[1] === 0x4d && u[2] === 0x00 && u[3] === 0x2a)
  ) {
    return "tif";
  }
  return null;
}

export function kindFromMediaKey(key: string): "video" | "image" {
  return /\.(mp4|webm)$/i.test(key) ? "video" : "image";
}

export function makeObjectKey(userId: number, kind: "img" | "out", ext: string): string {
  return `${userId}_${randomId(kind)}.${ext}`;
}

export function publicMediaUrl(origin: string, key: string): string {
  return `${origin.replace(/\/$/, "")}/api/media?key=${encodeURIComponent(key)}`;
}

export function mediaKeyFromUrl(value: string): string | null {
  try {
    const key = new URL(value).searchParams.get("key");
    return key && isSafeMediaKey(key) ? key : null;
  } catch {
    return null;
  }
}

/** Copy a provider result into R2. Returns our public URL, or null to keep the provider URL. */
export async function persistRemoteMedia(
  bucket: R2Bucket,
  opts: { userId: number; sourceUrl: string; origin: string }
): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(opts.sourceUrl);
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const buf = await res.arrayBuffer();
  if (buf.byteLength < 32 || buf.byteLength > MAX_RESULT_BYTES) return null;

  const ct = res.headers.get("content-type") || "";
  const ext = extForResultType(ct, opts.sourceUrl);
  if (!ext) return null;

  const key = makeObjectKey(opts.userId, "out", ext);
  await bucket.put(key, buf, {
    httpMetadata: {
      contentType: mimeForExt(ext),
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return publicMediaUrl(opts.origin, key);
}
