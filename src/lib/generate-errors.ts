import type { ApiError } from "@/lib/api";

const KIE_API_KEY_MISSING =
  "KIE_API_KEY is not configured. Set it as a Cloudflare Workers secret to enable generation.";
const KIE_INSUFFICIENT_BALANCE =
  "KIE wallet has insufficient balance. Top up at kie.ai — this app will not invent a successful generate. Site credits were not kept for the failed provider call.";

/** Map generate/upload API failures to honest, user-facing copy. */
export function formatGenerateError(err: unknown, fallback = "Generation failed"): string {
  const e = err as ApiError;
  const payload = (e.payload || {}) as {
    message?: string;
    credits?: number;
    cost?: number;
    guestRemaining?: number;
  };
  const code = e.code || "";
  const message = e.message || payload.message || fallback;

  switch (code) {
    case "kie_api_key_missing":
      // Prefer canonical copy — provider/raw text must not hide the real cause.
      return KIE_API_KEY_MISSING;
    case "kie_insufficient_balance":
      return KIE_INSUFFICIENT_BALANCE;
    case "kie_create_failed":
      return message || "KIE rejected the job. No demo output was invented.";
    case "generation_timeout":
      return (
        message ||
        "Timed out waiting for generation. Check My Creations — the job may still finish."
      );
    case "insufficient_credits":
    case "insufficient credits":
      return (
        message ||
        `Not enough credits${
          typeof payload.credits === "number" ? ` (balance ${payload.credits})` : ""
        }.`
      );
    case "guest_limit":
      return message || "Free trial used up — sign up for 10 credits.";
    case "guest_lite_only":
      return message || "Free trial is Lite image-to-video only. Sign up for every model.";
    case "guest_image_required":
    case "image_url_required":
      return message || "Upload a start image for the free Lite trial.";
    case "first_last_requires_medium":
      return message || "First + last frame needs a signed-in Medium or Pro job.";
    case "job_in_flight":
      return message || "You already have jobs rendering. Wait for one to finish.";
    case "media_not_bound":
      return message || "Uploads need the MEDIA (R2) binding. Paste a public https image URL instead.";
    default:
      return message || fallback;
  }
}

/** Pull guestRemaining from an API error payload when present. */
export function guestRemainingFromError(err: unknown): number | null {
  const payload = (err as ApiError)?.payload as { guestRemaining?: unknown } | undefined;
  const n = payload?.guestRemaining;
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}
