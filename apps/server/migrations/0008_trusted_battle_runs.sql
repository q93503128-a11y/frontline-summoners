PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS trusted_battle_runs (
  battle_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  battle_kind TEXT NOT NULL CHECK (battle_kind IN ('MAIN', 'SPECIAL')),
  target_id TEXT NOT NULL,
  start_revision INTEGER NOT NULL CHECK (start_revision >= 0),
  start_snapshot_json TEXT NOT NULL,
  initial_state_hash TEXT NOT NULL,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL CHECK (expires_at > started_at),
  completion_fingerprint TEXT,
  completed_at INTEGER,
  result_json TEXT,
  claimed_at INTEGER,
  CHECK ((completion_fingerprint IS NULL) = (completed_at IS NULL)),
  CHECK ((completed_at IS NULL) = (result_json IS NULL)),
  CHECK (claimed_at IS NULL OR completed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS trusted_battle_runs_user_started_idx
  ON trusted_battle_runs(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS trusted_battle_runs_active_idx
  ON trusted_battle_runs(user_id, expires_at)
  WHERE completed_at IS NULL;
