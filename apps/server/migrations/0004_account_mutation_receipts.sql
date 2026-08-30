CREATE TABLE IF NOT EXISTS account_mutation_receipts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mutation_kind TEXT NOT NULL CHECK (mutation_kind IN ('MAIN_BATTLE_RESULT', 'RECORD_RESULT', 'RECRUITMENT')),
  mutation_id TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision >= 1),
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, mutation_kind, mutation_id)
);

CREATE INDEX IF NOT EXISTS account_mutation_receipts_created_at_idx
  ON account_mutation_receipts(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS account_battle_mutation_id_idx
  ON account_mutation_receipts(user_id, mutation_id)
  WHERE mutation_kind IN ('MAIN_BATTLE_RESULT', 'RECORD_RESULT');
