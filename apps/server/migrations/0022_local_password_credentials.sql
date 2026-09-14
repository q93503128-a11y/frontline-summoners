PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_password_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  salt_hex TEXT NOT NULL,
  verifier_hex TEXT NOT NULL,
  iterations INTEGER NOT NULL CHECK (iterations BETWEEN 100000 AND 1000000),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_password_credentials_username_ci
ON auth_password_credentials(lower(username));
