import { PLANS } from '../../../libs/env';
import { verifyWebhookSignature } from '../../../libs/stripe';
import {
  getUserByEmail,
  updateUserPlan,
  updateUserStripeCustomer,
  createSubscription,
  updateSubscriptionStatus,
} from '../../../libs/db';

// POST /api/stripe/webhook - Stripe Webhook Handler
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') || '';

  // Verify webhook signature
  const valid = await verifyWebhookSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Parse the webhook event
  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return Response.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;
        const customerEmail = session.customer_email || session.customer_details?.email;
        const planId = session.metadata?.planId;
        const plan = PLANS[planId as keyof typeof PLANS];

        if (customerEmail && plan) {
          // Find or update user
          let user = await getUserByEmail(env.DB, customerEmail);
          if (user) {
            await updateUserStripeCustomer(env.DB, user.id as number, customerId);
            await updateUserPlan(env.DB, user.id as number, planId, plan.credits);

            // Create subscription record
            await createSubscription(env.DB, {
              user_id: user.id as number,
              stripe_subscription_id: session.subscription,
              stripe_customer_id: customerId,
              plan: planId,
            });
          }
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const status = subscription.status === 'active' ? 'active' : 'canceled';
        const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        await updateSubscriptionStatus(
          env.DB,
          subscription.id,
          status,
          periodEnd
        );

        // If canceled, downgrade user plan
        if (event.type === 'customer.subscription.deleted') {
          // Find user by stripe customer ID
          const userResult = await env.DB
            .prepare('SELECT * FROM users WHERE stripe_customer_id = ?')
            .bind(subscription.customer)
            .first();

          if (userResult) {
            await updateUserPlan(env.DB, userResult.id as number, 'free', 0);
          }
        }
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return Response.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
};
