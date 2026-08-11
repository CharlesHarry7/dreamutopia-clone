import { PLANS } from '../../../libs/env';
import { createCheckoutSession } from '../../../libs/stripe';
import { verifySession } from '../../../libs/auth';
import { getUserById } from '../../../libs/db';

// Price IDs (set via wrangler pages secret put STRIPE_PRICE_*)
const PRICE_IDS: Record<string, string> = {
  starter: '', // Set in production: env.STRIPE_PRICE_STARTER
  pro: '',     // env.STRIPE_PRICE_PRO
  optimum: '', // env.STRIPE_PRICE_OPTIMUM
};

// POST /api/stripe/checkout - Create Stripe Checkout Session
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Verify auth
  const session = await verifySession(env, request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { planId } = await request.json();
  const plan = PLANS[planId as keyof typeof PLANS];

  if (!plan) {
    return Response.json({ error: 'Invalid plan' }, { status: 400 });
  }

  // Get price ID from environment
  const priceKey = `STRIPE_PRICE_${planId.toUpperCase()}`;
  const priceId = (env as any)[priceKey] || PRICE_IDS[planId];

  if (!priceId) {
    return Response.json({ error: 'Price not configured' }, { status: 500 });
  }

  const user = await getUserById(env.DB, session.userId);

  const checkoutSession = await createCheckoutSession(env, {
    priceId,
    successUrl: `${env.APP_URL}/dashboard?success=true`,
    cancelUrl: `${env.APP_URL}/pricing?canceled=true`,
    customerId: user?.stripe_customer_id || undefined,
  });

  return Response.json({ url: checkoutSession.url });
};
