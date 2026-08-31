PRAGMA foreign_keys = ON;

CREATE TABLE social_pvp_invites (
  invite_id TEXT PRIMARY KEY,
  inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  mode_id TEXT NOT NULL DEFAULT 'pvp_friendly_1v1' CHECK (mode_id IN ('pvp_friendly_1v1')),
  growth_policy TEXT NOT NULL CHECK (growth_policy IN ('STANDARDIZED','ACTUAL')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','DECLINED','CANCELLED')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  responded_at INTEGER,
  CHECK (inviter_id <> invitee_id)
);

CREATE INDEX idx_social_pvp_invites_invitee
  ON social_pvp_invites(invitee_id, status, expires_at DESC);
CREATE INDEX idx_social_pvp_invites_inviter
  ON social_pvp_invites(inviter_id, status, created_at DESC);
CREATE UNIQUE INDEX idx_social_pvp_invites_pending_pair
  ON social_pvp_invites(inviter_id, invitee_id, mode_id)
  WHERE status = 'PENDING';
