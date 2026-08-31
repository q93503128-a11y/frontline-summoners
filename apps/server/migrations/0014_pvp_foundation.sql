PRAGMA foreign_keys = ON;

-- 0001 created an early prototype table named pvp_ratings. Keep that history/data
-- intact, but move it out of the canonical v1 namespace before creating the new
-- revisioned season/ranking model below.
ALTER TABLE pvp_ratings RENAME TO pvp_ratings_legacy;

CREATE TABLE pvp_ratings (
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

CREATE INDEX idx_pvp_ratings_season_mmr
  ON pvp_ratings(season_id, mmr DESC, ranked_wins DESC, updated_at ASC);

CREATE TABLE pvp_matches (
  match_id TEXT PRIMARY KEY,
  mode_id TEXT NOT NULL CHECK (mode_id IN (
    'pvp_casual_1v1','pvp_ranked_1v1','pvp_friendly_1v1','pvp_casual_2v2','pvp_friendly_2v2'
  )),
  season_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'CREATED' CHECK (state IN ('CREATED','ACTIVE','COMPLETED','VOID','EXPIRED')),
  result TEXT CHECK (result IS NULL OR result IN ('A','B','DRAW')),
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  CHECK (
    (state IN ('CREATED','ACTIVE') AND result IS NULL AND completed_at IS NULL)
    OR (state = 'COMPLETED' AND result IS NOT NULL AND completed_at IS NOT NULL)
    OR (state IN ('VOID','EXPIRED'))
  )
);

CREATE INDEX idx_pvp_matches_season
  ON pvp_matches(season_id, mode_id, completed_at DESC);

CREATE TABLE pvp_match_participants (
  match_id TEXT NOT NULL REFERENCES pvp_matches(match_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL CHECK (team_id IN ('A','B')),
  seat_index INTEGER NOT NULL CHECK (seat_index IN (0,1)),
  mmr_before INTEGER CHECK (mmr_before IS NULL OR mmr_before >= 0),
  mmr_after INTEGER CHECK (mmr_after IS NULL OR mmr_after >= 0),
  PRIMARY KEY (match_id, user_id),
  UNIQUE (match_id, team_id, seat_index)
);

CREATE INDEX idx_pvp_participants_user
  ON pvp_match_participants(user_id, match_id);

CREATE TABLE pvp_matchmaking_queue (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mode_id TEXT NOT NULL CHECK (mode_id IN ('pvp_casual_1v1','pvp_ranked_1v1','pvp_casual_2v2')),
  season_id TEXT NOT NULL,
  mmr_snapshot INTEGER NOT NULL CHECK (mmr_snapshot >= 0),
  state TEXT NOT NULL DEFAULT 'QUEUED' CHECK (state IN ('QUEUED','PAIRING','MATCHED')),
  queued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > queued_at),
  match_id TEXT,
  team_id TEXT CHECK (team_id IS NULL OR team_id IN ('A','B')),
  seat_index INTEGER CHECK (seat_index IS NULL OR seat_index IN (0,1)),
  paired_at INTEGER,
  CHECK (
    (state = 'QUEUED' AND match_id IS NULL AND team_id IS NULL AND seat_index IS NULL AND paired_at IS NULL)
    OR
    (state IN ('PAIRING','MATCHED') AND match_id IS NOT NULL AND team_id IS NOT NULL AND seat_index IS NOT NULL AND paired_at IS NOT NULL)
  )
);

CREATE INDEX idx_pvp_queue_mode_mmr
  ON pvp_matchmaking_queue(mode_id, season_id, state, mmr_snapshot, queued_at)
  WHERE state = 'QUEUED';
CREATE UNIQUE INDEX idx_pvp_queue_match_seat
  ON pvp_matchmaking_queue(match_id, team_id, seat_index)
  WHERE match_id IS NOT NULL;
