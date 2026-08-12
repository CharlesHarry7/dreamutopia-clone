/**
 * KIE Market API client (image-to-video).
 * Docs: https://docs.kie.ai/market/kling/image-to-video
 * No R2/MEDIA dependency — input/output are public HTTPS URLs.
 */

export const KIE_API_BASE = "https://api.kie.ai";
export const KIE_I2V_MODEL = "kling-2.6/image-to-video";
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

/** Map UI duration (3–15) to KIE-supported "5" | "10". */
export function kieDuration(durationSec: number): "5" | "10" {
  return durationSec <= 5 ? "5" : "10";
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

/** Create a Kling 2.6 image-to-video task. */
export async function createImageToVideoTask(
  apiKey: string,
  opts: {
    prompt: string;
    imageUrl: string;
    durationSec: number;
    sound: boolean;
  }
): Promise<KieCreateResult | KieCreateError> {
  let res: Response;
  try {
    res = await fetch(`${KIE_API_BASE}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        model: KIE_I2V_MODEL,
        input: {
          prompt: opts.prompt.slice(0, 1000),
          image_urls: [opts.imageUrl],
          sound: opts.sound,
          duration: kieDuration(opts.durationSec),
        },
      }),
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

/** Create a Nano Banana 2 text-to-image (or image-to-image if imageUrl is set). */
export async function createImageTask(
  apiKey: string,
  opts: {
    prompt: string;
    imageUrl?: string | null;
    resolution: "1K" | "2K";
  }
): Promise<KieCreateResult | KieCreateError> {
  const input: Record<string, unknown> = {
    prompt: opts.prompt.slice(0, 20000),
    aspect_ratio: "auto",
    resolution: opts.resolution,
    output_format: opts.resolution === "2K" ? "png" : "jpg",
  };
  if (opts.imageUrl) input.image_input = [opts.imageUrl];

  let res: Response;
  try {
    res = await fetch(`${KIE_API_BASE}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        model: KIE_T2I_MODEL,
        input,
      }),
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
