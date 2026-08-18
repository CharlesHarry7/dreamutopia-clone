import type { ApiError } from "@/lib/api";
import {
  KIE_API_KEY_MISSING_MESSAGE,
  KIE_INSUFFICIENT_BALANCE_MESSAGE,
} from "@/lib/kie-messages";

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
      return KIE_API_KEY_MISSING_MESSAGE;
    case "kie_insufficient_balance":
      return `${KIE_INSUFFICIENT_BALANCE_MESSAGE} Site credits were not kept for the failed provider call.`;
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
    case "generation_failed":
      // Settle/poll failure — map provider text the same way as history rows.
      return formatStoredJobError(message);
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

/** Map stored job errorMessage (history rows) to the same honest KIE copy as create. */
export function formatStoredJobError(message: string | null | undefined): string {
  if (!message || !message.trim()) return "Generation failed";
  const m = message.toLowerCase();
  if (m.includes("kie_api_key_missing") || m.includes("kie_api_key is not configured")) {
    return KIE_API_KEY_MISSING_MESSAGE;
  }
  if (
    m.includes("kie_insufficient_balance") ||
    /insufficient\s+(account\s+)?(balance|credit|funds)/i.test(message) ||
    m.includes("wallet has insufficient")
  ) {
    return KIE_INSUFFICIENT_BALANCE_MESSAGE;
  }
  if (m.includes("kie_create_failed") || m.includes("failed to create kie")) {
    return message.includes("demo") ? message : `${message} No demo output was invented.`;
  }
  return message;
}
