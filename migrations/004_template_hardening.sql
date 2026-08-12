-- Stripe customer reuse (template), provider-job lookup, one refund per generation.
-- Apply once:
--   npx wrangler d1 execute dreamutopia-db --remote --file=migrations/004_template_hardening.sql

ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_generations_provider_job ON generations(provider_job_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_events_refund_gen ON credit_events(reason)
  WHERE reason LIKE 'refund:gen:%';
