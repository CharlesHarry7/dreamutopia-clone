/** Browser API client — same contract as legacy assets/js/du.js */

export const TOKEN_KEY = "dreamutopia_token";
export const CREDITS_KEY = "dreamutopia_credits";
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type ApiError = Error & {
  status?: number;
  code?: string | null;
  payload?: unknown;
};

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setSession(token: string, credits?: number) {
  localStorage.setItem(TOKEN_KEY, token);
  if (typeof credits === "number") localStorage.setItem(CREDITS_KEY, String(credits));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CREDITS_KEY);
}

export function captureReferral() {
  try {
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref && /^[a-z0-9]{6,16}$/i.test(ref.trim())) {
      localStorage.setItem("du_ref", ref.trim());
    }
  } catch {
    /* ignore */
  }
}

export function getStoredReferral(): string {
  try {
    return localStorage.getItem("du_ref") || "";
  } catch {
    return "";
  }
}

export function isAllowedImageFile(file: File | null): boolean {
  if (!file) return false;
  const type = (file.type || "").toLowerCase();
  if (/^image\/(jpeg|jpg|png|webp|gif|tiff|tif|x-tiff)$/.test(type)) return true;
  if (!type || type === "application/octet-stream") {
    return /\.(jpe?g|png|webp|gif|tiff?)$/i.test(file.name || "");
  }
  return false;
}

export async function api<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (options.body && typeof options.body === "string" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(
      String(data.message || data.error || "request failed")
    ) as ApiError;
    err.status = res.status;
    err.code = (data.code as string) || (data.error as string) || null;
    err.payload = data;
    throw err;
  }
  return data as T;
}

export function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function uploadImage(file: File): Promise<{ key: string; imageUrl: string }> {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (file.type && file.type !== "application/octet-stream") headers.set("content-type", file.type);
  else if (/\.tiff?$/i.test(file.name || "")) headers.set("content-type", "image/tiff");
  const res = await fetch("/api/upload", {
    method: "POST",
    headers,
    body: file,
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(String(data.message || data.error || "upload failed")) as ApiError;
    err.status = res.status;
    err.code = (data.code as string) || (data.error as string) || null;
    err.payload = data;
    throw err;
  }
  return data as { key: string; imageUrl: string };
}

export async function pollGeneration(
  id: string,
  onTick?: (data: Record<string, unknown>) => void
): Promise<Record<string, unknown>> {
  for (let i = 0; i < 90; i++) {
    const data = await api<Record<string, unknown>>(`/generate?id=${encodeURIComponent(id)}`);
    onTick?.(data);
    const status = String(data.status || "");
    if (status === "done" || status === "failed") return data;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Timed out waiting for generation");
}
