PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pvp_ratings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL DEFAULT 'preseason_v1',
  mmr INTEGER NOT NULL DEFAULT 1000 CHECK (mmr >= 0),
  best_mmr INTEGER NOT NULL DEFAULT 1000 CHECK (best_mmr >= 0),
  displayed_tier TEXT NOT NULL DEFAULT 'SILVER' CHECK (displayed_tier IN (
    'BRONZE','SILVER','GOLD','PLATINUM','DIAMOND','MASTER','GRANDMASTER','FRONTLINE_APEX'
  )),
  placement_matches INTEGER NOT NULL DEFAULT 0 CHECK (placement_matches >= 0 AND placement_matches <= 5),
  ranked_wins INTEGER NOT NULL DEFAULT 0 CHECK (ranked_wins >= 0),
  ranked_losses INTEGER NOT NULL DEFAULT 0 CHECK (ranked_losses >= 0),
  ranked_draws INTEGER NOT NULL DEFAULT 0 CHECK (ranked_draws >= 0),
  casual_wins INTEGER NOT NULL DEFAULT 0 CHECK (casual_wins >= 0),
  casual_losses INTEGER NOT NULL DEFAULT 0 CHECK (casual_losses >= 0),
  casual_draws INTEGER NOT NULL DEFAULT 0 CHECK (casual_draws >= 0),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pvp_ratings_season_mmr
  ON pvp_ratings(season_id, mmr DESC, ranked_wins DESC, updated_at ASC);

CREATE TABLE IF NOT EXISTS pvp_matches (
  match_id TEXT PRIMARY KEY,
  mode_id TEXT NOT NULL CHECK (mode_id IN (
    'pvp_casual_1v1','pvp_ranked_1v1','pvp_friendly_1v1','pvp_casual_2v2','pvp_friendly_2v2'
  )),
  season_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'CREATED' CHECK (state IN ('CREATED','ACTIVE','COMPLETED','VOID','EXPIRED')),
  account_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  result TEXT CHECK (result IS NULL OR result IN ('A','B','DRAW')),
  a_mmr_before INTEGER CHECK (a_mmr_before IS NULL OR a_mmr_before >= 0),
  b_mmr_before INTEGER CHECK (b_mmr_before IS NULL OR b_mmr_before >= 0),
  a_mmr_after INTEGER CHECK (a_mmr_after IS NULL OR a_mmr_after >= 0),
  b_mmr_after INTEGER CHECK (b_mmr_after IS NULL OR b_mmr_after >= 0),
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  CHECK (account_a <> account_b),
  CHECK (
    (state IN ('CREATED','ACTIVE') AND result IS NULL AND completed_at IS NULL)
    OR (state = 'COMPLETED' AND result IS NOT NULL AND completed_at IS NOT NULL)
    OR (state IN ('VOID','EXPIRED'))
  )
);

CREATE INDEX IF NOT EXISTS idx_pvp_matches_account_a
  ON pvp_matches(account_a, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pvp_matches_account_b
  ON pvp_matches(account_b, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pvp_matches_season
  ON pvp_matches(season_id, mode_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS pvp_matchmaking_queue (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mode_id TEXT NOT NULL CHECK (mode_id IN ('pvp_casual_1v1','pvp_ranked_1v1','pvp_casual_2v2')),
  season_id TEXT NOT NULL,
  mmr_snapshot INTEGER NOT NULL CHECK (mmr_snapshot >= 0),
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

CREATE INDEX IF NOT EXISTS idx_pvp_queue_mode_mmr
  ON pvp_matchmaking_queue(mode_id, season_id, state, mmr_snapshot, queued_at)
  WHERE state = 'QUEUED';
CREATE UNIQUE INDEX IF NOT EXISTS idx_pvp_queue_match_seat
  ON pvp_matchmaking_queue(match_id, seat_id)
  WHERE match_id IS NOT NULL;
