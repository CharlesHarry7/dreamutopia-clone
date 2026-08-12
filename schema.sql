-- DreamUtopia Clone — D1 Schema
-- 用户/额度/生成记录/作品墙

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 10,
  referral_code TEXT,
  referred_by INTEGER,
  first_purchase_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

CREATE TABLE IF NOT EXISTS credit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  stripe_session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_events_stripe ON credit_events(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS generations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  model TEXT NOT NULL DEFAULT 'lite',       -- lite|medium|pro or image-lite|image-pro
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | done | failed
  media_key TEXT,                          -- R2 object key (optional)
  duration_sec INTEGER DEFAULT 5,
  input_image_url TEXT,                    -- start URL, or JSON {"first","last"}
  provider_job_id TEXT,                    -- KIE taskId
  result_url TEXT,                         -- provider result video URL (direct to client)
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS gallery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generation_id INTEGER,
  media_key TEXT NOT NULL,
  prompt TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (generation_id) REFERENCES generations(id)
);

CREATE INDEX IF NOT EXISTS idx_generations_user ON generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_created ON gallery(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_generation ON gallery(generation_id);
