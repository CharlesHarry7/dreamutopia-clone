/** R2 upload helpers — keys are unguessable and safe as query params. */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MEDIA_KEY_RE = /^[0-9]+_img_[a-f0-9]{16}\.(jpg|png|webp|gif)$/;

export function isSafeMediaKey(key: string): boolean {
  return MEDIA_KEY_RE.test(key);
}

export function extForContentType(contentType: string): string | null {
  const ct = contentType.split(";")[0].trim().toLowerCase();
  return IMAGE_TYPES[ct] || null;
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
