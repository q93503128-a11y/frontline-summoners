PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pvp_first_reach_reward_receipts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_id TEXT NOT NULL CHECK (tier_id IN (
    'SILVER','GOLD','PLATINUM','DIAMOND','MASTER','GRANDMASTER','FRONTLINE_APEX'
  )),
  reward_json TEXT NOT NULL,
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision >= 1),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, tier_id)
);

CREATE INDEX IF NOT EXISTS idx_pvp_first_reach_reward_user_time
  ON pvp_first_reach_reward_receipts(user_id, created_at DESC);
