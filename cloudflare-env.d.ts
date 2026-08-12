interface CloudflareEnv {
  DB?: D1Database;
  SESSIONS?: KVNamespace;
  MEDIA?: R2Bucket;
  ASSETS?: Fetcher;
  KIE_API_KEY?: string;
  KIE_API_BASE?: string;
  KIE_WEBHOOK_HMAC_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
}
