/** Client-safe pack labels (mirrors server packs for UI). */

export type PackId = "starter" | "plus" | "pro" | "premium";

const PACK_LABELS: Record<PackId, { name: string; credits: number; usd: number }> = {
  starter: { name: "Starter Pack", credits: 10, usd: 5 },
  plus: { name: "Plus Pack", credits: 50, usd: 25 },
  pro: { name: "Pro Pack", credits: 200, usd: 90 },
  premium: { name: "Premium Pack", credits: 500, usd: 200 },
};

export function parsePackId(value: string | null | undefined): PackId | null {
  if (value === "starter" || value === "plus" || value === "pro" || value === "premium") return value;
  return null;
}

export function packLabel(id: string | null | undefined): {
  id: string;
  name: string;
  credits: number;
  usd: number;
} | null {
  const parsed = parsePackId(id);
  if (!parsed) return null;
  return { id: parsed, ...PACK_LABELS[parsed] };
}
