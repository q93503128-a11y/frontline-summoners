PRAGMA foreign_keys = ON;

-- Single-row operational latch for safe ranked-season closure. The row is created
-- lazily by server code so a fresh deployment always seeds the season id compiled
-- into that release instead of baking a one-off season id into the migration.
CREATE TABLE pvp_season_operations (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  season_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('OPEN','DRAINING','CLOSED_PENDING_DEPLOY')),
  queue_open INTEGER NOT NULL CHECK (queue_open IN (0, 1)),
  next_season_id TEXT,
  started_at INTEGER,
  finalized_at INTEGER,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (
    (state = 'OPEN' AND queue_open = 1 AND next_season_id IS NULL AND started_at IS NULL AND finalized_at IS NULL)
    OR
    (state = 'DRAINING' AND queue_open = 0 AND next_season_id IS NOT NULL AND started_at IS NOT NULL AND finalized_at IS NULL)
    OR
    (state = 'CLOSED_PENDING_DEPLOY' AND queue_open = 0 AND next_season_id IS NOT NULL AND started_at IS NOT NULL AND finalized_at IS NOT NULL)
  ),
  CHECK (next_season_id IS NULL OR next_season_id <> season_id)
);
