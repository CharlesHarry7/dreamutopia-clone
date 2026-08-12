/**
 * Anonymous 2-free Lite video trials (cookie + IP), stored in the SESSIONS KV.
 * Guest jobs are not written to D1 — they are not saved to an account history.
 */

import { randomId } from "./utils";

export const GUEST_COOKIE = "du_guest";
export const GUEST_LIMIT = 2;
/** R2 object prefix for guest uploads / results (matches media key regex). */
export const GUEST_USER_ID = 0;
const GUEST_TTL = 60 * 60 * 24 * 365;
const IP_TTL = 60 * 60 * 24 * 30;

export type GuestJob = {
  id: string;
  providerJobId: string;
  prompt: string;
  kind: "video";
  model: "lite";
  status: string;
  inputImageUrl: string | null;
  resultUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type GuestRecord = {
  id: string;
  used: number;
  jobs: GuestJob[];
};

export function guestIdFromRequest(request: Request): string | null {
  const header = request.headers.get("cookie") || "";
  const parts = header.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === GUEST_COOKIE) {
      const v = rest.join("=").trim();
      if (/^gst_[a-f0-9]{16}$/.test(v)) return v;
    }
  }
  return null;
}

export function ensureGuestId(request: Request): string {
  return guestIdFromRequest(request) || randomId("gst");
}

export function guestCookieHeader(id: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${GUEST_COOKIE}=${id}; Path=/; Max-Age=${GUEST_TTL}; HttpOnly; SameSite=Lax${secure}`;
}

export function guestHeaders(id: string, request: Request): Record<string, string> {
  return { "set-cookie": guestCookieHeader(id, request) };
}

export function clientIp(request: Request): string | null {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf && cf.trim()) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  return null;
}

export async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function guestKey(id: string): string {
  return `guest:id:${id}`;
}

function ipKey(hash: string): string {
  return `guest:ip:${hash}`;
}

export async function loadGuest(
  env: { SESSIONS: KVNamespace },
  id: string
): Promise<GuestRecord> {
  const raw = await env.SESSIONS.get(guestKey(id));
  if (!raw) return { id, used: 0, jobs: [] };
  try {
    const parsed = JSON.parse(raw) as GuestRecord;
    if (!parsed || parsed.id !== id) return { id, used: 0, jobs: [] };
    return {
      id,
      used: Number(parsed.used) || 0,
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
    };
  } catch {
    return { id, used: 0, jobs: [] };
  }
}

export async function saveGuest(env: { SESSIONS: KVNamespace }, rec: GuestRecord): Promise<void> {
  rec.jobs = rec.jobs.slice(0, 8);
  await env.SESSIONS.put(guestKey(rec.id), JSON.stringify(rec), { expirationTtl: GUEST_TTL });
}

export async function loadIpUsed(env: { SESSIONS: KVNamespace }, ip: string | null): Promise<number> {
  if (!ip) return 0;
  const hash = await hashIp(ip);
  const raw = await env.SESSIONS.get(ipKey(hash));
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function saveIpUsed(
  env: { SESSIONS: KVNamespace },
  ip: string | null,
  used: number
): Promise<void> {
  if (!ip) return;
  const hash = await hashIp(ip);
  await env.SESSIONS.put(ipKey(hash), String(Math.max(0, used)), { expirationTtl: IP_TTL });
}

export function remainingOf(used: number): number {
  return Math.max(0, GUEST_LIMIT - used);
}

export async function guestQuota(
  env: { SESSIONS: KVNamespace },
  rec: GuestRecord,
  ip: string | null
): Promise<{ remaining: number; used: number; blocked: boolean }> {
  const ipUsed = await loadIpUsed(env, ip);
  const used = Math.max(rec.used, ipUsed);
  return { remaining: remainingOf(used), used, blocked: used >= GUEST_LIMIT };
}

export function isGuestJobId(id: string): boolean {
  return /^g_[a-f0-9]{16}$/.test(id);
}
