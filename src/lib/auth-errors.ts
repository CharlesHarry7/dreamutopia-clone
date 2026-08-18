import type { ApiError } from "@/lib/api";

/** Honest client copy for auth / reset / forgot — no raw provider/bindings passthrough. */
export function formatAuthError(err: unknown, fallback = "Something went wrong"): string {
  const e = err as ApiError;
  const code = (e.code || "").toLowerCase();
  const message = (e.message || "").toLowerCase();
  const status = e.status;

  if (status === 401 || code === "unauthorized" || message.includes("invalid email or password")) {
    return "Invalid email or password.";
  }
  if (status === 409 || message.includes("already registered")) {
    return "That email is already registered — try Log In.";
  }
  if (code === "email_not_configured" || message.includes("email_not_configured")) {
    return "Password reset email isn’t configured on this Worker yet.";
  }
  if (code === "email_send_failed" || message.includes("email_send_failed")) {
    return "Couldn’t send the reset email. Try again later.";
  }
  if (
    code === "invalid_or_expired_token" ||
    message.includes("invalid or expired") ||
    message.includes("expired token")
  ) {
    return "This reset link is invalid or expired. Request a new one.";
  }
  if (message.includes("at least 6") || message.includes("password too short")) {
    return "Password must be at least 6 characters.";
  }
  if (status === 429 || code === "rate_limited" || message.includes("rate limit")) {
    return "Too many attempts — wait a moment and try again.";
  }
  if (
    code === "bindings_missing" ||
    message.includes("backend not configured") ||
    (message.includes("missing") && message.includes("binding"))
  ) {
    return "Account service isn’t ready (database/session bindings). Try again later.";
  }
  if (message.includes("invalid json")) {
    return "Couldn’t read that request. Refresh and try again.";
  }

  // Prefer short, non-infra messages; otherwise fallback.
  if (e.message && e.message.length < 120 && !/cloudflare|wrangler|d1|kv namespace/i.test(e.message)) {
    return e.message;
  }
  return fallback;
}
