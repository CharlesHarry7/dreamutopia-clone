import type { Env } from './env';

// D1 database helper functions

export async function getUserByEmail(db: D1Database, email: string) {
  const result = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  return result;
}

export async function getUserById(db: D1Database, id: number) {
  const result = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return result;
}

export async function createUser(db: D1Database, data: { email: string; name?: string; image?: string }) {
  const result = await db
    .prepare('INSERT INTO users (email, name, image) VALUES (?, ?, ?) RETURNING *')
    .bind(data.email, data.name || null, data.image || null)
    .first();
  return result;
}

export async function updateUserPlan(db: D1Database, userId: number, plan: string, credits: number) {
  await db
    .prepare('UPDATE users SET plan = ?, credits = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(plan, credits, userId)
    .run();
}

export async function updateUserStripeCustomer(db: D1Database, userId: number, customerId: string) {
  await db
    .prepare('UPDATE users SET stripe_customer_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(customerId, userId)
    .run();
}

export async function createSubscription(
  db: D1Database,
  data: { user_id: number; stripe_subscription_id: string; stripe_customer_id: string; plan: string }
) {
  const result = await db
    .prepare(
      `INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_customer_id, plan)
       VALUES (?, ?, ?, ?) RETURNING *`
    )
    .bind(data.user_id, data.stripe_subscription_id, data.stripe_customer_id, data.plan)
    .first();
  return result;
}

export async function updateSubscriptionStatus(
  db: D1Database,
  stripeSubscriptionId: string,
  status: string,
  currentPeriodEnd: string
) {
  await db
    .prepare(
      `UPDATE subscriptions SET status = ?, current_period_end = ?, updated_at = datetime('now')
       WHERE stripe_subscription_id = ?`
    )
    .bind(status, currentPeriodEnd, stripeSubscriptionId)
    .run();
}
