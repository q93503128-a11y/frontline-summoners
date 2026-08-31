PRAGMA foreign_keys = ON;

-- Ranked season closure is snapshotted separately from the live rating row so a
-- soft reset never destroys final standings or season-honor eligibility.
CREATE TABLE pvp_season_closures (
  season_id TEXT PRIMARY KEY,
  next_season_id TEXT NOT NULL,
  closed_at INTEGER NOT NULL,
  rolled_at INTEGER,
  player_count INTEGER NOT NULL CHECK (player_count >= 0),
  placement_player_count INTEGER NOT NULL CHECK (placement_player_count >= 0),
  CHECK (next_season_id <> season_id),
  CHECK (placement_player_count <= player_count)
);

CREATE TABLE pvp_season_results (
  season_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  final_mmr INTEGER NOT NULL CHECK (final_mmr >= 0),
  best_mmr INTEGER NOT NULL CHECK (best_mmr >= 0),
  final_tier TEXT NOT NULL CHECK (final_tier IN (
    'BRONZE','SILVER','GOLD','PLATINUM','DIAMOND','MASTER','GRANDMASTER','FRONTLINE_APEX'
  )),
  placement_matches INTEGER NOT NULL CHECK (placement_matches >= 0 AND placement_matches <= 5),
  ranked_wins INTEGER NOT NULL CHECK (ranked_wins >= 0),
  ranked_losses INTEGER NOT NULL CHECK (ranked_losses >= 0),
  ranked_draws INTEGER NOT NULL CHECK (ranked_draws >= 0),
  final_rank INTEGER CHECK (final_rank IS NULL OR final_rank >= 1),
  honor_claimed_at INTEGER,
  honor_json TEXT,
  PRIMARY KEY (season_id, user_id),
  FOREIGN KEY (season_id) REFERENCES pvp_season_closures(season_id) ON DELETE CASCADE,
  CHECK ((honor_claimed_at IS NULL AND honor_json IS NULL) OR (honor_claimed_at IS NOT NULL AND honor_json IS NOT NULL))
);

CREATE INDEX idx_pvp_season_results_user
  ON pvp_season_results(user_id, season_id);
CREATE INDEX idx_pvp_season_results_rank
  ON pvp_season_results(season_id, final_rank)
  WHERE final_rank IS NOT NULL;
