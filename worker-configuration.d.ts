interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_STARTER: string;
  STRIPE_PRICE_PRO: string;
  STRIPE_PRICE_OPTIMUM: string;
  RESEND_API_KEY: string;
  JWT_SECRET: string;
  APP_URL: string;
}
