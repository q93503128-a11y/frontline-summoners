PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS coop_matchmaking_queue (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'QUEUED' CHECK (state IN ('QUEUED','PAIRING','MATCHED')),
  queued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > queued_at),
  match_id TEXT,
  seat_id TEXT CHECK (seat_id IS NULL OR seat_id IN ('A','B')),
  paired_at INTEGER,
  CHECK (
    (state = 'QUEUED' AND match_id IS NULL AND seat_id IS NULL AND paired_at IS NULL)
    OR
    (state IN ('PAIRING','MATCHED') AND match_id IS NOT NULL AND seat_id IS NOT NULL AND paired_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_coop_matchmaking_stage_queue
  ON coop_matchmaking_queue(stage_id, state, queued_at)
  WHERE state = 'QUEUED';

CREATE INDEX IF NOT EXISTS idx_coop_matchmaking_match
  ON coop_matchmaking_queue(match_id, state)
  WHERE match_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_coop_matchmaking_match_seat
  ON coop_matchmaking_queue(match_id, seat_id)
  WHERE match_id IS NOT NULL;
