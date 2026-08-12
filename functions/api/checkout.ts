import { json, preflight } from "../../libs/utils";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

/**
 * GET/POST /api/checkout — payment stub.
 * Stripe / crypto / Stars are not configured in this repo.
 * UI must treat checkout_not_configured as "not live" (no fake charges).
 */
function notConfigured(): Response {
  return json(
    {
      ok: false,
      reason: "checkout_not_configured",
      message: "Paid checkout is not live yet. No payment provider is configured.",
    },
    503
  );
}

export const onRequestGet: PagesFunction<Env> = async () => notConfigured();
export const onRequestPost: PagesFunction<Env> = async () => notConfigured();
