/**
 * KIE Market API client.
 * Docs:
 *   https://docs.kie.ai/market/kling/image-to-video
 *   https://docs.kie.ai/market/kling/text-to-video
 *   https://docs.kie.ai/market/kling/kling-3-0
 *   https://docs.kie.ai/market/google/nanobanana2
 */

export const KIE_API_BASE = "https://api.kie.ai";
export const KIE_I2V_MODEL = "kling-2.6/image-to-video";
export const KIE_T2V_MODEL = "kling-2.6/text-to-video";
export const KIE_FLF_MODEL = "kling-3.0/video";
export const KIE_T2I_MODEL = "nano-banana-2";

export type KieTaskState =
  | "waiting"
  | "queuing"
  | "generating"
  | "success"
  | "fail"
  | string;

export interface KieCreateResult {
  ok: true;
  taskId: string;
}

export interface KieCreateError {
  ok: false;
  status: number;
  code?: number;
  message: string;
}

export interface KieTaskInfo {
  ok: true;
  taskId: string;
  state: KieTaskState;
  resultUrl: string | null;
  failCode: string | null;
  failMsg: string | null;
}

export interface KieTaskError {
  ok: false;
  status: number;
  code?: number;
  message: string;
}

export type AspectRatio = "1:1" | "16:9" | "9:16";
export type ImageResolution = "1K" | "2K" | "4K";

/** Map UI duration (3–15) to KIE 2.6-supported "5" | "10". */
export function kieDuration(durationSec: number): "5" | "10" {
  return durationSec <= 5 ? "5" : "10";
}

export function kieDuration3(durationSec: number): string {
  const n = Math.min(Math.max(Math.round(durationSec) || 5, 3), 15);
  return String(n);
}

export function parseAspectRatio(value: unknown): AspectRatio {
  if (value === "1:1" || value === "9:16" || value === "16:9") return value;
  return "16:9";
}

export function parseImageResolution(value: unknown, fallback: ImageResolution): ImageResolution {
  if (value === "1K" || value === "2K" || value === "4K") return value;
  return fallback;
}

export function isPublicHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !!u.hostname;
  } catch {
    return false;
  }
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function parseResultUrl(resultJson: unknown): string | null {
  if (!resultJson) return null;
  let parsed: unknown = resultJson;
  if (typeof resultJson === "string") {
    try {
      parsed = JSON.parse(resultJson);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const urls = (parsed as { resultUrls?: unknown }).resultUrls;
  if (Array.isArray(urls) && typeof urls[0] === "string" && urls[0]) {
    return urls[0];
  }
  return null;
}

async function createKieTask(
  apiKey: string,
  model: string,
  input: Record<string, unknown>,
  callBackUrl?: string
): Promise<KieCreateResult | KieCreateError> {
  const payload: Record<string, unknown> = { model, input };
  if (callBackUrl && /^https:\/\//i.test(callBackUrl)) {
    payload.callBackUrl = callBackUrl;
  }
  let res: Response;
  try {
    res = await fetch(`${KIE_API_BASE}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      message: e instanceof Error ? e.message : "KIE request failed",
    };
  }

  let body: { code?: number; msg?: string; message?: string; data?: { taskId?: string } } = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  const taskId = body.data?.taskId;
  if (res.ok && body.code === 200 && taskId) {
    return { ok: true, taskId };
  }

  return {
    ok: false,
    status: res.status || 502,
    code: body.code,
    message: body.msg || body.message || `KIE createTask failed (${res.status})`,
  };
}

/** Kling 2.6 image-to-video (one start frame). */
export function createImageToVideoTask(
  apiKey: string,
  opts: {
    prompt: string;
    imageUrl: string;
    durationSec: number;
    sound: boolean;
    callBackUrl?: string;
  }
): Promise<KieCreateResult | KieCreateError> {
  return createKieTask(
    apiKey,
    KIE_I2V_MODEL,
    {
      prompt: opts.prompt.slice(0, 1000),
      image_urls: [opts.imageUrl],
      sound: opts.sound,
      duration: kieDuration(opts.durationSec),
    },
    opts.callBackUrl
  );
}

/** Kling 2.6 text-to-video (no start image). */
export function createTextToVideoTask(
  apiKey: string,
  opts: {
    prompt: string;
    durationSec: number;
    sound: boolean;
    aspectRatio: AspectRatio;
    callBackUrl?: string;
  }
): Promise<KieCreateResult | KieCreateError> {
  return createKieTask(
    apiKey,
    KIE_T2V_MODEL,
    {
      prompt: opts.prompt.slice(0, 1000),
      sound: opts.sound,
      aspect_ratio: opts.aspectRatio,
      duration: kieDuration(opts.durationSec),
    },
    opts.callBackUrl
  );
}

/** Kling 3.0 first + last frame (Medium/Pro). */
export function createFirstLastVideoTask(
  apiKey: string,
  opts: {
    prompt: string;
    firstUrl: string;
    lastUrl: string;
    durationSec: number;
    sound: boolean;
    mode: "std" | "pro";
    callBackUrl?: string;
  }
): Promise<KieCreateResult | KieCreateError> {
  return createKieTask(
    apiKey,
    KIE_FLF_MODEL,
    {
      prompt: opts.prompt.slice(0, 1000),
      image_urls: [opts.firstUrl, opts.lastUrl],
      sound: opts.sound,
      duration: kieDuration3(opts.durationSec),
      mode: opts.mode,
      multi_shots: false,
    },
    opts.callBackUrl
  );
}

/** Nano Banana 2 text-to-image, image-to-image, or multi-image blend. */
export function createImageTask(
  apiKey: string,
  opts: {
    prompt: string;
    imageUrls?: string[];
    resolution: ImageResolution;
    callBackUrl?: string;
  }
): Promise<KieCreateResult | KieCreateError> {
  const input: Record<string, unknown> = {
    prompt: opts.prompt.slice(0, 20000),
    aspect_ratio: "auto",
    resolution: opts.resolution,
    output_format: opts.resolution === "1K" ? "jpg" : "png",
  };
  const urls = (opts.imageUrls || []).filter(Boolean).slice(0, 14);
  if (urls.length) input.image_input = urls;
  return createKieTask(apiKey, KIE_T2I_MODEL, input, opts.callBackUrl);
}

/** Poll KIE task status; parse first result URL when success. */
export async function getTaskInfo(
  apiKey: string,
  taskId: string
): Promise<KieTaskInfo | KieTaskError> {
  let res: Response;
  try {
    const url = `${KIE_API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;
    res = await fetch(url, { headers: authHeaders(apiKey) });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      message: e instanceof Error ? e.message : "KIE status request failed",
    };
  }

  let body: {
    code?: number;
    msg?: string;
    message?: string;
    data?: {
      taskId?: string;
      state?: string;
      resultJson?: string;
      failCode?: string | null;
      failMsg?: string | null;
    };
  } = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok || (body.code !== undefined && body.code !== 200)) {
    return {
      ok: false,
      status: res.status || 502,
      code: body.code,
      message: body.msg || body.message || `KIE recordInfo failed (${res.status})`,
    };
  }

  const data = body.data || {};
  return {
    ok: true,
    taskId: data.taskId || taskId,
    state: data.state || "waiting",
    resultUrl: parseResultUrl(data.resultJson),
    failCode: data.failCode || null,
    failMsg: data.failMsg || null,
  };
}

/** Never leak KIE wallet / “top up” copy to the browser. */
export function publicProviderFailMessage(raw: string | null | undefined): string {
  const s = (raw || "").trim();
  if (!s) return "Generation failed";
  if (/credits insufficient|balance isn.?t enough|top up|\b402\b/i.test(s)) {
    return "Generation is temporarily unavailable. Please try again later.";
  }
  return s;
}
