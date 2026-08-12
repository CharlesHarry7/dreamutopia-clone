-- Temporary URL-path generation (no R2): store provider job + result URL.
-- Safe to re-run only if columns are missing (SQLite ADD COLUMN fails if present).
-- Apply once:
--   npx wrangler d1 execute dreamutopia-db --remote --file=migrations/001_generations_kie.sql

ALTER TABLE generations ADD COLUMN input_image_url TEXT;
ALTER TABLE generations ADD COLUMN provider_job_id TEXT;
ALTER TABLE generations ADD COLUMN result_url TEXT;
ALTER TABLE generations ADD COLUMN error_message TEXT;
