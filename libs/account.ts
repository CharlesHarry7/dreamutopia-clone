/** Referral codes, first-purchase bonus, and copying guest KV jobs into D1 history. */

import { randomId } from "./utils";
import { mediaKeyFromUrl } from "./media";
import {
  FIRST_PURCHASE_BONUS_CREDITS,
  REFERRAL_PERCENT,
  type CreditPack,
} from "./packs";
import { guestIdFromRequest, loadGuest, type GuestJob } from "./guest";

export function makeReferralCode(): string {
  const rand = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureReferralCode(
  db: D1Database,
  userId: number
): Promise<string> {
  const row = await db
    .prepare("SELECT referral_code FROM users WHERE id = ?")
    .bind(userId)
    .first<{ referral_code: string | null }>();
  if (row?.referral_code) return row.referral_code;
  for (let i = 0; i < 6; i++) {
    const code = makeReferralCode();
    try {
      await db.prepare("UPDATE users SET referral_code = ? WHERE id = ? AND (referral_code IS NULL OR referral_code = '')")
        .bind(code, userId)
        .run();
      const again = await db
        .prepare("SELECT referral_code FROM users WHERE id = ?")
        .bind(userId)
        .first<{ referral_code: string | null }>();
      if (again?.referral_code) return again.referral_code;
    } catch {
      /* unique collision — retry */
    }
  }
  const fallback = randomId("ref").slice(0, 12);
  await db.prepare("UPDATE users SET referral_code = ? WHERE id = ?").bind(fallback, userId).run();
  return fallback;
}

export async function lookupReferrer(
  db: D1Database,
  code: string | null | undefined
): Promise<number | null> {
  const c = (code || "").trim().toLowerCase();
  // Keep in sync with out/assets/js/du.js normalizeRef.
  if (!/^[a-f0-9]{8}$/.test(c) && !/^ref_[a-z0-9]+$/i.test(c)) {
    if (!/^[a-z0-9]{6,16}$/i.test(c)) return null;
  }
  const row = await db
    .prepare("SELECT id FROM users WHERE lower(referral_code) = ?")
    .bind(c)
    .first<{ id: number }>();
  return row ? Number(row.id) : null;
}

export async function mergeGuestJobs(
  env: { DB: D1Database; SESSIONS: KVNamespace },
  request: Request,
  userId: number
): Promise<number> {
  const guestId = guestIdFromRequest(request);
  if (!guestId) return 0;
  const rec = await loadGuest(env, guestId);
  if (!rec.jobs.length) return 0;

  let copied = 0;
  for (const job of rec.jobs) {
    if (job.providerJobId) {
      const existing = await env.DB.prepare(
        "SELECT id FROM generations WHERE user_id = ? AND provider_job_id = ?"
      )
        .bind(userId, job.providerJobId)
        .first();
      if (existing) continue;
    }
    copied += (await insertGuestJob(env.DB, userId, job)) ? 1 : 0;
  }
  // Keep KV jobs so in-flight guest polls (`g_…`) still resolve after signup.
  return copied;
}

async function insertGuestJob(db: D1Database, userId: number, job: GuestJob): Promise<boolean> {
  const mediaKey = job.resultUrl ? mediaKeyFromUrl(job.resultUrl) : null;
  try {
    await db
      .prepare(
        `INSERT INTO generations (
           user_id, model, prompt, status, media_key, duration_sec,
           input_image_url, provider_job_id, result_url, error_message, created_at
         ) VALUES (?, ?, ?, ?, ?, 5, ?, ?, ?, ?, ?)`
      )
      .bind(
        userId,
        job.model || "lite",
        job.prompt || "",
        job.status || "done",
        mediaKey,
        job.inputImageUrl,
        job.providerJobId || null,
        job.resultUrl,
        job.errorMessage,
        job.createdAt || new Date().toISOString()
      )
      .run();
    return true;
  } catch {
    return false;
  }
}

export function isSchemaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no such (column|table)|schema_migration/i.test(msg);
}

export async function applyPaidPack(
  db: D1Database,
  opts: { userId: number; pack: CreditPack; stripeSessionId: string }
): Promise<{ credits: number; firstPurchase: boolean; referralAward: number }> {
  const existing = await db
    .prepare("SELECT id FROM credit_events WHERE stripe_session_id = ?")
    .bind(opts.stripeSessionId)
    .first();
  if (existing) {
    const row = await db
      .prepare("SELECT credits FROM users WHERE id = ?")
      .bind(opts.userId)
      .first<{ credits: number }>();
    return { credits: row ? Number(row.credits) : 0, firstPurchase: false, referralAward: 0 };
  }

  const user = await db
    .prepare("SELECT id, credits, first_purchase_at, referred_by FROM users WHERE id = ?")
    .bind(opts.userId)
    .first<{
      id: number;
      credits: number;
      first_purchase_at: string | null;
      referred_by: number | null;
    }>();
  if (!user) throw new Error("user not found");

  const firstPurchase = !user.first_purchase_at;
  let delta = opts.pack.credits;
  if (firstPurchase) delta += FIRST_PURCHASE_BONUS_CREDITS;

  let referralAward = 0;
  const referrerId = user.referred_by ? Number(user.referred_by) : 0;
  if (referrerId && referrerId !== opts.userId) {
    referralAward = Math.floor((opts.pack.credits * REFERRAL_PERCENT) / 100);
  }

  const statements = [
    db
      .prepare(
        firstPurchase
          ? "UPDATE users SET credits = credits + ?, first_purchase_at = datetime('now') WHERE id = ?"
          : "UPDATE users SET credits = credits + ? WHERE id = ?"
      )
      .bind(delta, opts.userId),
    db
      .prepare(
        "INSERT INTO credit_events (user_id, delta, reason, stripe_session_id) VALUES (?, ?, ?, ?)"
      )
      .bind(
        opts.userId,
        delta,
        firstPurchase ? `pack:${opts.pack.id}:first` : `pack:${opts.pack.id}`,
        opts.stripeSessionId
      ),
  ];

  if (referralAward > 0) {
    statements.push(
      db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").bind(referralAward, referrerId),
      db
        .prepare(
          "INSERT INTO credit_events (user_id, delta, reason, stripe_session_id) VALUES (?, ?, ?, ?)"
        )
        .bind(
          referrerId,
          referralAward,
          `referral:${opts.pack.id}:from:${opts.userId}`,
          `${opts.stripeSessionId}:ref`
        )
    );
  }

  try {
    await db.batch(statements);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint failed/i.test(msg)) {
      const row = await db
        .prepare("SELECT credits FROM users WHERE id = ?")
        .bind(opts.userId)
        .first<{ credits: number }>();
      return { credits: row ? Number(row.credits) : 0, firstPurchase: false, referralAward: 0 };
    }
    throw err;
  }

  const next = await db
    .prepare("SELECT credits FROM users WHERE id = ?")
    .bind(opts.userId)
    .first<{ credits: number }>();
  return {
    credits: next ? Number(next.credits) : 0,
    firstPurchase,
    referralAward,
  };
}

export async function getStripeCustomerId(db: D1Database, userId: number): Promise<string | null> {
  try {
    const row = await db
      .prepare("SELECT stripe_customer_id FROM users WHERE id = ?")
      .bind(userId)
      .first<{ stripe_customer_id: string | null }>();
    const id = row?.stripe_customer_id?.trim();
    return id || null;
  } catch (err) {
    if (isSchemaError(err)) return null;
    throw err;
  }
}

export async function saveStripeCustomerId(
  db: D1Database,
  userId: number,
  customerId: string
): Promise<void> {
  const id = customerId.trim();
  if (!id) return;
  try {
    await db
      .prepare(
        "UPDATE users SET stripe_customer_id = ? WHERE id = ? AND (stripe_customer_id IS NULL OR stripe_customer_id = '')"
      )
      .bind(id, userId)
      .run();
  } catch (err) {
    if (isSchemaError(err)) return;
    throw err;
  }
}
