import type { ApiError } from "@/lib/api";

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
      return (
        message ||
        "KIE_API_KEY is not configured. Set it as a Cloudflare Workers secret to enable generation."
      );
    case "kie_insufficient_balance":
      return (
        message ||
        "KIE wallet has insufficient balance. Top up at kie.ai — this app will not fake a successful generate."
      );
    case "kie_create_failed":
      return message || "KIE rejected the job. No demo output was invented.";
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
