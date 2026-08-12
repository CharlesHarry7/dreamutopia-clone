/** Credit packs shown on /pricing — amounts in USD cents. */

export type PackId = "starter" | "plus" | "pro" | "premium";

export type CreditPack = {
  id: PackId;
  name: string;
  usdCents: number;
  credits: number;
};

export const PACKS: Record<PackId, CreditPack> = {
  starter: { id: "starter", name: "Starter Pack", usdCents: 500, credits: 10 },
  plus: { id: "plus", name: "Plus Pack", usdCents: 2500, credits: 50 },
  pro: { id: "pro", name: "Pro Pack", usdCents: 9000, credits: 200 },
  premium: { id: "premium", name: "Premium Pack", usdCents: 20000, credits: 500 },
};

/** 5 Lite videos (3 each) + 1 Pro video (16) on the first paid purchase. */
export const FIRST_PURCHASE_BONUS_CREDITS = 5 * 3 + 16;
export const REFERRAL_PERCENT = 10;

export function parsePackId(value: unknown): PackId | null {
  if (value === "starter" || value === "plus" || value === "pro" || value === "premium") return value;
  return null;
}

export function publicPacks() {
  return Object.values(PACKS).map((p) => ({
    id: p.id,
    name: p.name,
    usd: p.usdCents / 100,
    credits: p.credits,
  }));
}
