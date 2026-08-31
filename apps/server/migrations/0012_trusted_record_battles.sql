PRAGMA foreign_keys = ON;

CREATE TABLE trusted_battle_runs_v2 (
  battle_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  battle_kind TEXT NOT NULL CHECK (battle_kind IN ('MAIN', 'SPECIAL', 'RECORD')),
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

INSERT INTO trusted_battle_runs_v2 (
  battle_id, user_id, battle_kind, target_id, start_revision, start_snapshot_json,
  initial_state_hash, started_at, expires_at, completion_fingerprint,
  completed_at, result_json, claimed_at
)
SELECT
  battle_id, user_id, battle_kind, target_id, start_revision, start_snapshot_json,
  initial_state_hash, started_at, expires_at, completion_fingerprint,
  completed_at, result_json, claimed_at
FROM trusted_battle_runs;

DROP TABLE trusted_battle_runs;
ALTER TABLE trusted_battle_runs_v2 RENAME TO trusted_battle_runs;

CREATE INDEX trusted_battle_runs_user_started_idx
  ON trusted_battle_runs(user_id, started_at DESC);

CREATE INDEX trusted_battle_runs_active_idx
  ON trusted_battle_runs(user_id, expires_at)
  WHERE completed_at IS NULL;
