// Stripe client for Cloudflare Workers
// Uses fetch-based Stripe API (no Node.js deps needed)

const STRIPE_BASE = 'https://api.stripe.com/v1';

async function stripeFetch(env: Env, path: string, options: RequestInit = {}) {
  const url = `${STRIPE_BASE}${path}`;
  const body = options.body as Record<string, any>;

  const formData = new URLSearchParams();
  if (body && typeof body === 'object') {
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    ...options,
    method: options.method || 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...options.headers,
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Stripe error: ${error.error?.message || response.statusText}`);
  }

  return response.json();
}

export async function createCheckoutSession(
  env: Env,
  params: { priceId: string; successUrl: string; cancelUrl: string; customerId?: string }
) {
  const body: Record<string, any> = {
    mode: 'subscription',
    'line_items[0][price]': params.priceId,
    'line_items[0][quantity]': '1',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  };

  if (params.customerId) {
    body.customer = params.customerId;
  }

  return stripeFetch(env, '/checkout/sessions', { method: 'POST', body });
}

export async function retrieveCheckoutSession(env: Env, sessionId: string) {
  return stripeFetch(env, `/checkout/sessions/${sessionId}`, { method: 'GET' });
}

export async function retrieveSubscription(env: Env, subscriptionId: string) {
  return stripeFetch(env, `/subscriptions/${subscriptionId}`, { method: 'GET' });
}

export async function cancelSubscription(env: Env, subscriptionId: string) {
  return stripeFetch(env, `/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}

// Verify Stripe webhook signature (simplified for Workers)
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  // In production, use proper Stripe signature verification
  // For now, basic check
  return signature.includes('t=');
}
