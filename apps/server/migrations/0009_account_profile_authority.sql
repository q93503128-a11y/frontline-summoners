CREATE TABLE IF NOT EXISTS account_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  snapshot_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_account_profiles_updated_at
  ON account_profiles(updated_at);

CREATE TABLE IF NOT EXISTS account_profile_mutation_receipts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision >= 0),
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_account_profile_receipts_created_at
  ON account_profile_mutation_receipts(created_at);
