PRAGMA foreign_keys = ON;

CREATE TABLE pvp_friendly_2v2_lobbies (
  invite_code TEXT PRIMARY KEY,
  host_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'WAITING' CHECK (state IN ('WAITING','MATCHED','CANCELLED','EXPIRED')),
  match_id TEXT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (expires_at > created_at),
  CHECK ((state = 'MATCHED' AND match_id IS NOT NULL) OR (state <> 'MATCHED'))
);

CREATE INDEX idx_pvp_friendly_2v2_lobbies_expiry
  ON pvp_friendly_2v2_lobbies(state, expires_at);
CREATE INDEX idx_pvp_friendly_2v2_lobbies_host
  ON pvp_friendly_2v2_lobbies(host_user_id, created_at DESC);
