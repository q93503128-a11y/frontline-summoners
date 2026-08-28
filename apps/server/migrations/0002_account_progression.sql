PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS account_progression_saves (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  snapshot_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_account_progression_updated_at
  ON account_progression_saves(updated_at DESC);
