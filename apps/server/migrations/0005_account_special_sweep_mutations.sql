CREATE TABLE account_mutation_receipts_v2 (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mutation_kind TEXT NOT NULL CHECK (mutation_kind IN ('MAIN_BATTLE_RESULT', 'SPECIAL_BATTLE_RESULT', 'RECORD_RESULT', 'RECRUITMENT', 'SWEEP')),
  mutation_id TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision >= 1),
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, mutation_kind, mutation_id)
);

INSERT INTO account_mutation_receipts_v2
  (user_id, mutation_kind, mutation_id, input_fingerprint, resulting_revision, result_json, created_at)
SELECT user_id, mutation_kind, mutation_id, input_fingerprint, resulting_revision, result_json, created_at
FROM account_mutation_receipts;

DROP TABLE account_mutation_receipts;
ALTER TABLE account_mutation_receipts_v2 RENAME TO account_mutation_receipts;

CREATE INDEX account_mutation_receipts_created_at_idx
  ON account_mutation_receipts(user_id, created_at DESC);

CREATE UNIQUE INDEX account_battle_mutation_id_idx
  ON account_mutation_receipts(user_id, mutation_id)
  WHERE mutation_kind IN ('MAIN_BATTLE_RESULT', 'SPECIAL_BATTLE_RESULT', 'RECORD_RESULT');
