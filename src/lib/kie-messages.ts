/** Shared KIE user-facing copy (Worker UI + API handlers). */

/** Canonical when Workers secret KIE_API_KEY is missing. */
export const KIE_API_KEY_MISSING_MESSAGE =
  "KIE_API_KEY is not configured. Set it as a Cloudflare Workers secret to enable generation.";

/** Canonical when KIE wallet cannot fund a job — never invent success. */
export const KIE_INSUFFICIENT_BALANCE_MESSAGE =
  "KIE wallet has insufficient balance. Top up at kie.ai — this app will not invent a successful generate.";
