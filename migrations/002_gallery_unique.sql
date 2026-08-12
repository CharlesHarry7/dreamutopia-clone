-- Opt-in public gallery: one row per generation.
-- Apply:
--   npx wrangler d1 execute dreamutopia-db --remote --file=migrations/002_gallery_unique.sql

CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_generation ON gallery(generation_id);
