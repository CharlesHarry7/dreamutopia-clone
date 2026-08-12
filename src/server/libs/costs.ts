/** Credit costs — same numbers as the workspace UI. */

export const VIDEO_COST: Record<string, number> = { lite: 3, medium: 5, pro: 16 };
export const IMAGE_COST: Record<string, number> = { lite: 1, pro: 2 };

export type GenerationKind = "video" | "image";

export function parseStoredModel(stored: string): { kind: GenerationKind; model: string } {
  if (stored.startsWith("image-")) {
    const model = stored.slice(6);
    return { kind: "image", model: IMAGE_COST[model] ? model : "lite" };
  }
  return { kind: "video", model: VIDEO_COST[stored] ? stored : "lite" };
}

export function storeModel(kind: GenerationKind, model: string): string {
  return kind === "image" ? `image-${model}` : model;
}

export function costForStoredModel(stored: string): number {
  const parsed = parseStoredModel(stored);
  const table = parsed.kind === "image" ? IMAGE_COST : VIDEO_COST;
  return table[parsed.model] || 0;
}
