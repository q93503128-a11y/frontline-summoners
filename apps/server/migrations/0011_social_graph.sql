PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS social_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  friend_code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  online_until INTEGER NOT NULL DEFAULT 0 CHECK (online_until >= 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS social_friend_requests (
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_social_friend_requests_addressee ON social_friend_requests(addressee_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_friendships (
  user_low TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_low, user_high),
  CHECK (user_low < user_high)
);
CREATE INDEX IF NOT EXISTS idx_social_friendships_high ON social_friendships(user_high, created_at DESC);

CREATE TABLE IF NOT EXISTS social_blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_social_blocks_blocked ON social_blocks(blocked_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_recent_players (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  other_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_match_id TEXT NOT NULL,
  last_stage_id TEXT NOT NULL,
  play_count INTEGER NOT NULL DEFAULT 1 CHECK (play_count >= 1),
  last_played_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, other_user_id),
  CHECK (user_id <> other_user_id)
);
CREATE INDEX IF NOT EXISTS idx_social_recent_players_time ON social_recent_players(user_id, last_played_at DESC);

CREATE TABLE IF NOT EXISTS social_coop_invites (
  invite_id TEXT PRIMARY KEY,
  inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL UNIQUE,
  stage_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','DECLINED','CANCELLED')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  responded_at INTEGER,
  CHECK (inviter_id <> invitee_id)
);
CREATE INDEX IF NOT EXISTS idx_social_coop_invites_invitee ON social_coop_invites(invitee_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_coop_invites_inviter ON social_coop_invites(inviter_id, status, created_at DESC);
