import type { Env } from "../../../libs/utils";
import { onRequestPost as stripeWebhook } from "../webhooks/stripe";

/** Template-compatible alias: /api/stripe/webhook → /api/webhooks/stripe */
export const onRequestPost: PagesFunction<Env> = (ctx) => stripeWebhook(ctx);
