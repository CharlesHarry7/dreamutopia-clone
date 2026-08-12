import { json, preflight } from "../../libs/utils";
import type { Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

/**
 * GET/POST /api/checkout — payment stub.
 * Stripe / crypto / Stars are not configured. UI must not pretend a charge will happen.
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
