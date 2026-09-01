PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pvp_casual_reward_receipts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL REFERENCES pvp_matches(match_id) ON DELETE CASCADE,
  mode_id TEXT NOT NULL CHECK (mode_id IN ('pvp_casual_1v1','pvp_casual_2v2')),
  reward_day TEXT NOT NULL,
  reward_slot INTEGER CHECK (reward_slot IS NULL OR reward_slot BETWEEN 1 AND 3),
  participation_gold INTEGER NOT NULL CHECK (participation_gold >= 0),
  win_bonus_gold INTEGER NOT NULL CHECK (win_bonus_gold >= 0),
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision >= 0),
  awarded_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, match_id),
  UNIQUE (user_id, reward_day, reward_slot)
);

CREATE INDEX IF NOT EXISTS idx_pvp_casual_reward_user_day
  ON pvp_casual_reward_receipts(user_id, reward_day, reward_slot);
