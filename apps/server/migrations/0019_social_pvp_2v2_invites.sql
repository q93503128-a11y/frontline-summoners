PRAGMA foreign_keys = ON;

CREATE TABLE social_pvp_2v2_invites (
  invite_id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL REFERENCES pvp_friendly_2v2_lobbies(invite_code) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','DECLINED','CANCELLED')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  responded_at INTEGER,
  CHECK (host_id <> invitee_id)
);

CREATE INDEX idx_social_pvp_2v2_invites_invitee
  ON social_pvp_2v2_invites(invitee_id, status, expires_at DESC);
CREATE INDEX idx_social_pvp_2v2_invites_host
  ON social_pvp_2v2_invites(host_id, invite_code, status, created_at DESC);
CREATE UNIQUE INDEX idx_social_pvp_2v2_invites_pending_target
  ON social_pvp_2v2_invites(host_id, invitee_id, invite_code)
  WHERE status = 'PENDING';
