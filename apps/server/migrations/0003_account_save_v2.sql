CREATE TABLE IF NOT EXISTS account_saves (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  schema_version INTEGER NOT NULL CHECK (schema_version = 2),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  snapshot_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS account_saves_updated_at_idx
  ON account_saves(updated_at);
