PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS auth_identities (
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS currencies (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
  recruit_tokens INTEGER NOT NULL DEFAULT 0 CHECK (recruit_tokens >= 0),
  stardust INTEGER NOT NULL DEFAULT 0 CHECK (stardust >= 0),
  common_shards INTEGER NOT NULL DEFAULT 0 CHECK (common_shards >= 0),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS owned_units (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 50),
  form INTEGER NOT NULL DEFAULT 1 CHECK (form BETWEEN 1 AND 3),
  shards INTEGER NOT NULL DEFAULT 0 CHECK (shards >= 0),
  acquired_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, unit_id)
);

CREATE TABLE IF NOT EXISTS decks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_index INTEGER NOT NULL CHECK (deck_index >= 0),
  name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, deck_index)
);

CREATE TABLE IF NOT EXISTS stage_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL,
  clear_count INTEGER NOT NULL DEFAULT 0 CHECK (clear_count >= 0),
  best_clear_frames INTEGER,
  objective_mask INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, stage_id)
);

CREATE TABLE IF NOT EXISTS gacha_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banner_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  rarity TEXT NOT NULL,
  pulled_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_gacha_history_user_time ON gacha_history(user_id, pulled_at DESC);

CREATE TABLE IF NOT EXISTS pvp_ratings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  queue_id TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1000,
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, queue_id)
);
