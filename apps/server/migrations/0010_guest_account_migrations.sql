CREATE TABLE IF NOT EXISTS account_guest_migrations (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  migration_id TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('IMPORT_IF_EMPTY', 'REPLACE_EXISTING')),
  previous_revision INTEGER NOT NULL CHECK (previous_revision >= 0),
  previous_snapshot_json TEXT NOT NULL,
  previous_profile_revision INTEGER NOT NULL CHECK (previous_profile_revision >= 0),
  previous_profile_snapshot_json TEXT NOT NULL,
  imported_revision INTEGER NOT NULL CHECK (imported_revision > previous_revision),
  imported_profile_revision INTEGER NOT NULL CHECK (imported_profile_revision > previous_profile_revision),
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  restored_at INTEGER,
  restored_revision INTEGER,
  restored_profile_revision INTEGER,
  PRIMARY KEY (user_id, migration_id)
);

CREATE INDEX IF NOT EXISTS idx_account_guest_migrations_user_created
  ON account_guest_migrations(user_id, created_at DESC);
