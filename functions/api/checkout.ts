import { json, preflight, asHead, hasDb, hasSessions, type Env } from "../../libs/utils";
import { getSessionUser } from "../../libs/auth";
import { getStripeCustomerId } from "../../libs/account";
import {
  FIRST_PURCHASE_BONUS_CREDITS,
  PACKS,
  REFERRAL_PERCENT,
  parsePackId,
  publicPacks,
} from "../../libs/packs";
import { createCheckoutSession, hasStripe } from "../../libs/stripe";
import { rateLimitedResponse, takeRateLimit } from "../../libs/rateLimit";

export const onRequestOptions = (): Response => preflight();

function catalog(configured: boolean) {
  return {
    ok: configured,
    configured,
    packs: publicPacks(),
    firstPurchaseBonus: FIRST_PURCHASE_BONUS_CREDITS,
    referralPercent: REFERRAL_PERCENT,
    ...(configured
      ? {}
      : {
          error: "checkout_not_configured",
          code: "checkout_not_configured",
          message: "Set Pages secrets STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (see BACKEND.md).",
        }),
  };
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const configured = hasStripe(env);
  // Honest 503 until Stripe is configured — never look like a live charge endpoint.
  return json(catalog(configured), configured ? 200 : 503);
};

export const onRequestHead: PagesFunction<Env> = async (ctx) => asHead(await onRequestGet(ctx));

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!hasStripe(env) || !env.STRIPE_SECRET_KEY) {
    return json(
      {
        error: "checkout_not_configured",
        code: "checkout_not_configured",
        configured: false,
        message: "Set Pages secrets STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (see BACKEND.md).",
      },
      503
    );
  }

  const session = await getSessionUser(env, request);
  if (!session) return json({ error: "unauthorized" }, 401);

  if (hasSessions(env)) {
    const rl = await takeRateLimit(env.SESSIONS, `pay:u:${session.userId}`, 10, 60);
    if (!rl.ok) return rateLimitedResponse(json, rl.retryAfter);
  }

  let body: { packId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const packId = parsePackId(body.packId);
  if (!packId) return json({ error: "unknown_pack" }, 400);
  const pack = PACKS[packId];

  const origin = new URL(request.url).origin;
  const customerId = hasDb(env) ? await getStripeCustomerId(env.DB, session.userId).catch(() => null) : null;
  const created = await createCheckoutSession({
    secretKey: env.STRIPE_SECRET_KEY,
    origin,
    userId: session.userId,
    email: session.email,
    pack,
    customerId,
  });

  if (!created.ok) {
    return json(
      {
        error: "stripe_session_failed",
        code: "stripe_session_failed",
        message: "Checkout could not start. No charge was made.",
      },
      created.status >= 400 && created.status < 600 ? created.status : 502
    );
  }

  return json({ ok: true, url: created.url, id: created.id });
};
