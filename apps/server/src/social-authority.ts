import { initializeAccountProfile } from './account-profile-authority.ts';

export const SOCIAL_PRESENCE_TTL_SECONDS = 90;
export const SOCIAL_COOP_INVITE_TTL_SECONDS = 10 * 60;
export const SOCIAL_RECENT_PLAYER_LIMIT = 20;

export interface SocialPublicProfile {
  readonly friendCode: string;
  readonly displayName: string;
  readonly online: boolean;
  readonly portraitCharacterId?: string;
  readonly titleId?: string;
  readonly frameId: string;
}

export interface SocialRecentPlayer {
  readonly profile: SocialPublicProfile;
  readonly lastMatchId: string;
  readonly lastStageId: string;
  readonly playCount: number;
  readonly lastPlayedAtMs: number;
  readonly interactionAllowed: boolean;
}

export interface SocialCoopInviteRecord {
  readonly inviteId: string;
  readonly inviterId: string;
  readonly inviteeId: string;
  readonly matchId: string;
  readonly stageId: string;
  readonly status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  readonly expiresAtMs: number;
  readonly createdAtMs: number;
}

export interface SocialCoopInviteView {
  readonly inviteId: string;
  readonly inviter: SocialPublicProfile;
  readonly matchId: string;
  readonly stageId: string;
  readonly expiresAtMs: number;
}

export interface SocialSummary {
  readonly self: SocialPublicProfile;
  readonly friends: readonly SocialPublicProfile[];
  readonly incomingRequests: readonly SocialPublicProfile[];
  readonly outgoingRequests: readonly SocialPublicProfile[];
  readonly blocked: readonly SocialPublicProfile[];
  readonly recentPlayers: readonly SocialRecentPlayer[];
  readonly coopInvites: readonly SocialCoopInviteView[];
}

type SocialProfileRow = {
  readonly user_id: string;
  readonly friend_code: string;
  readonly display_name: string;
  readonly online_until: number;
};

type UserIdRow = { readonly user_id: string };
type RecentRow = {
  readonly other_user_id: string;
  readonly last_match_id: string;
  readonly last_stage_id: string;
  readonly play_count: number;
  readonly last_played_at: number;
};
type InviteRow = {
  readonly invite_id: string;
  readonly inviter_id: string;
  readonly invitee_id: string;
  readonly match_id: string;
  readonly stage_id: string;
  readonly status: SocialCoopInviteRecord['status'];
  readonly expires_at: number;
  readonly created_at: number;
};

function nonEmptyId(value: string, context: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 128) throw new Error(`${context} must be 1..128 characters`);
  return trimmed;
}

function normalizeDisplayName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2 || trimmed.length > 20) throw new Error('display_name_length');
  for (const char of trimmed) if (char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f) throw new Error('display_name_control_character');
  return trimmed;
}

export function normalizeFriendCode(value: string): string {
  return value.trim().toUpperCase();
}

function randomFriendCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `FS-${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function friendPair(a: string, b: string): readonly [string, string] {
  if (a === b) throw new Error('social_self_target');
  return a < b ? [a, b] : [b, a];
}

async function socialProfileRow(db: D1Database, userId: string): Promise<SocialProfileRow | null> {
  return db.prepare(
    'SELECT user_id, friend_code, display_name, online_until FROM social_profiles WHERE user_id = ?1',
  ).bind(userId).first<SocialProfileRow>();
}

export async function ensureSocialProfile(db: D1Database, rawUserId: string): Promise<SocialProfileRow> {
  const userId = nonEmptyId(rawUserId, 'userId');
  const existing = await socialProfileRow(db, userId);
  if (existing) return existing;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const friendCode = randomFriendCode();
    const displayName = `지휘관-${friendCode.slice(-4)}`;
    try {
      const result = await db.prepare(
        'INSERT INTO social_profiles (user_id, friend_code, display_name) VALUES (?1, ?2, ?3)',
      ).bind(userId, friendCode, displayName).run();
      if ((result.meta.changes ?? 0) === 1) {
        const created = await socialProfileRow(db, userId);
        if (created) return created;
      }
    } catch {
      const raced = await socialProfileRow(db, userId);
      if (raced) return raced;
    }
  }
  throw new Error('social_friend_code_generation_failed');
}

export async function touchSocialPresence(db: D1Database, userId: string, nowMs = Date.now()): Promise<void> {
  await ensureSocialProfile(db, userId);
  const onlineUntil = Math.floor(nowMs / 1000) + SOCIAL_PRESENCE_TTL_SECONDS;
  await db.prepare(
    'UPDATE social_profiles SET online_until = ?1, updated_at = unixepoch() WHERE user_id = ?2',
  ).bind(onlineUntil, userId).run();
}

async function publicProfile(db: D1Database, userId: string, nowMs: number): Promise<SocialPublicProfile> {
  const row = await ensureSocialProfile(db, userId);
  const profile = await initializeAccountProfile(db, userId, nowMs);
  const loadout = profile.snapshot.profileLoadout;
  return {
    friendCode: row.friend_code,
    displayName: row.display_name,
    online: row.online_until > Math.floor(nowMs / 1000),
    ...(loadout.portraitCharacterId === undefined ? {} : { portraitCharacterId: loadout.portraitCharacterId }),
    ...(loadout.titleId === undefined ? {} : { titleId: loadout.titleId }),
    frameId: loadout.frameId,
  };
}

export async function updateSocialDisplayName(
  db: D1Database,
  userId: string,
  displayName: string,
  nowMs = Date.now(),
): Promise<SocialPublicProfile> {
  const normalized = normalizeDisplayName(displayName);
  await ensureSocialProfile(db, userId);
  await db.prepare(
    'UPDATE social_profiles SET display_name = ?1, updated_at = unixepoch() WHERE user_id = ?2',
  ).bind(normalized, userId).run();
  await touchSocialPresence(db, userId, nowMs);
  return publicProfile(db, userId, nowMs);
}

export async function resolveSocialUserByFriendCode(db: D1Database, rawFriendCode: string): Promise<string | null> {
  const friendCode = normalizeFriendCode(rawFriendCode);
  if (friendCode.length < 4 || friendCode.length > 32) return null;
  const row = await db.prepare('SELECT user_id FROM social_profiles WHERE friend_code = ?1').bind(friendCode).first<UserIdRow>();
  return row?.user_id ?? null;
}

export async function isEitherSocialBlocked(db: D1Database, a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const row = await db.prepare(
    `SELECT 1 AS blocked FROM social_blocks
     WHERE (blocker_id = ?1 AND blocked_id = ?2) OR (blocker_id = ?2 AND blocked_id = ?1)
     LIMIT 1`,
  ).bind(a, b).first<{ blocked: number }>();
  return row?.blocked === 1;
}

export async function areSocialFriends(db: D1Database, a: string, b: string): Promise<boolean> {
  if (a === b || await isEitherSocialBlocked(db, a, b)) return false;
  const [low, high] = friendPair(a, b);
  const row = await db.prepare(
    'SELECT 1 AS friend FROM social_friendships WHERE user_low = ?1 AND user_high = ?2',
  ).bind(low, high).first<{ friend: number }>();
  return row?.friend === 1;
}

export async function sendSocialFriendRequest(db: D1Database, requesterId: string, addresseeId: string): Promise<void> {
  if (requesterId === addresseeId) throw new Error('social_self_target');
  await ensureSocialProfile(db, requesterId);
  await ensureSocialProfile(db, addresseeId);
  if (await isEitherSocialBlocked(db, requesterId, addresseeId)) throw new Error('social_blocked');
  if (await areSocialFriends(db, requesterId, addresseeId)) throw new Error('social_already_friends');
  const reverse = await db.prepare(
    'SELECT 1 AS pending FROM social_friend_requests WHERE requester_id = ?1 AND addressee_id = ?2',
  ).bind(addresseeId, requesterId).first<{ pending: number }>();
  if (reverse?.pending === 1) throw new Error('social_incoming_request_exists');
  await db.prepare(
    'INSERT OR IGNORE INTO social_friend_requests (requester_id, addressee_id) VALUES (?1, ?2)',
  ).bind(requesterId, addresseeId).run();
}

export async function acceptSocialFriendRequest(db: D1Database, addresseeId: string, requesterId: string): Promise<void> {
  if (addresseeId === requesterId) throw new Error('social_self_target');
  if (await isEitherSocialBlocked(db, addresseeId, requesterId)) throw new Error('social_blocked');
  const pending = await db.prepare(
    'SELECT 1 AS pending FROM social_friend_requests WHERE requester_id = ?1 AND addressee_id = ?2',
  ).bind(requesterId, addresseeId).first<{ pending: number }>();
  if (pending?.pending !== 1) throw new Error('social_friend_request_missing');
  const [low, high] = friendPair(addresseeId, requesterId);
  const writes = await db.batch([
    db.prepare('DELETE FROM social_friend_requests WHERE (requester_id = ?1 AND addressee_id = ?2) OR (requester_id = ?2 AND addressee_id = ?1)').bind(addresseeId, requesterId),
    db.prepare('INSERT OR IGNORE INTO social_friendships (user_low, user_high) VALUES (?1, ?2)').bind(low, high),
  ]);
  if ((writes[1]?.meta.changes ?? 0) !== 1 && !(await areSocialFriends(db, addresseeId, requesterId))) throw new Error('social_friendship_commit_failed');
}

export async function removeSocialFriend(db: D1Database, userId: string, otherUserId: string): Promise<void> {
  const [low, high] = friendPair(userId, otherUserId);
  await db.prepare('DELETE FROM social_friendships WHERE user_low = ?1 AND user_high = ?2').bind(low, high).run();
}

export async function blockSocialUser(db: D1Database, blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) throw new Error('social_self_target');
  const [low, high] = friendPair(blockerId, blockedId);
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO social_blocks (blocker_id, blocked_id) VALUES (?1, ?2)').bind(blockerId, blockedId),
    db.prepare('DELETE FROM social_friendships WHERE user_low = ?1 AND user_high = ?2').bind(low, high),
    db.prepare('DELETE FROM social_friend_requests WHERE (requester_id = ?1 AND addressee_id = ?2) OR (requester_id = ?2 AND addressee_id = ?1)').bind(blockerId, blockedId),
    db.prepare(`UPDATE social_coop_invites SET status = 'CANCELLED', responded_at = unixepoch()
                WHERE status = 'PENDING' AND ((inviter_id = ?1 AND invitee_id = ?2) OR (inviter_id = ?2 AND invitee_id = ?1))`).bind(blockerId, blockedId),
  ]);
}

export async function unblockSocialUser(db: D1Database, blockerId: string, blockedId: string): Promise<void> {
  await db.prepare('DELETE FROM social_blocks WHERE blocker_id = ?1 AND blocked_id = ?2').bind(blockerId, blockedId).run();
}

export async function recordRecentCoopPlayers(
  db: D1Database,
  userA: string,
  userB: string,
  matchId: string,
  stageId: string,
): Promise<void> {
  if (userA === userB) return;
  const statement = (userId: string, otherUserId: string) => db.prepare(
    `INSERT INTO social_recent_players (user_id, other_user_id, last_match_id, last_stage_id, play_count, last_played_at)
     VALUES (?1, ?2, ?3, ?4, 1, unixepoch())
     ON CONFLICT(user_id, other_user_id) DO UPDATE SET
       last_match_id = excluded.last_match_id,
       last_stage_id = excluded.last_stage_id,
       play_count = social_recent_players.play_count + 1,
       last_played_at = unixepoch()`,
  ).bind(userId, otherUserId, matchId, stageId);
  await db.batch([statement(userA, userB), statement(userB, userA)]);
}

export async function findPendingCoopInvite(
  db: D1Database,
  inviterId: string,
  inviteeId: string,
  stageId: string,
  nowMs = Date.now(),
): Promise<SocialCoopInviteRecord | null> {
  const nowSeconds = Math.floor(nowMs / 1000);
  const row = await db.prepare(
    `SELECT invite_id, inviter_id, invitee_id, match_id, stage_id, status, expires_at, created_at
     FROM social_coop_invites
     WHERE inviter_id = ?1 AND invitee_id = ?2 AND stage_id = ?3 AND status = 'PENDING' AND expires_at > ?4
     ORDER BY created_at DESC LIMIT 1`,
  ).bind(inviterId, inviteeId, stageId, nowSeconds).first<InviteRow>();
  return row ? inviteRowToRecord(row) : null;
}

export async function createSocialCoopInvite(
  db: D1Database,
  inviterId: string,
  inviteeId: string,
  matchId: string,
  stageId: string,
  nowMs = Date.now(),
): Promise<SocialCoopInviteRecord> {
  if (!await areSocialFriends(db, inviterId, inviteeId)) throw new Error('social_friend_required');
  if (await findPendingCoopInvite(db, inviterId, inviteeId, stageId, nowMs)) throw new Error('social_coop_invite_pending');
  const inviteId = crypto.randomUUID();
  const expiresAt = Math.floor(nowMs / 1000) + SOCIAL_COOP_INVITE_TTL_SECONDS;
  const write = await db.prepare(
    `INSERT INTO social_coop_invites (invite_id, inviter_id, invitee_id, match_id, stage_id, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  ).bind(inviteId, inviterId, inviteeId, matchId, stageId, expiresAt).run();
  if ((write.meta.changes ?? 0) !== 1) throw new Error('social_coop_invite_insert_failed');
  const row = await loadCoopInviteRow(db, inviteId);
  if (!row) throw new Error('social_coop_invite_missing_after_insert');
  return inviteRowToRecord(row);
}

async function loadCoopInviteRow(db: D1Database, inviteId: string): Promise<InviteRow | null> {
  return db.prepare(
    'SELECT invite_id, inviter_id, invitee_id, match_id, stage_id, status, expires_at, created_at FROM social_coop_invites WHERE invite_id = ?1',
  ).bind(inviteId).first<InviteRow>();
}

function inviteRowToRecord(row: InviteRow): SocialCoopInviteRecord {
  return {
    inviteId: row.invite_id,
    inviterId: row.inviter_id,
    inviteeId: row.invitee_id,
    matchId: row.match_id,
    stageId: row.stage_id,
    status: row.status,
    expiresAtMs: row.expires_at * 1000,
    createdAtMs: row.created_at * 1000,
  };
}

export async function getPendingCoopInviteForInvitee(
  db: D1Database,
  inviteeId: string,
  inviteId: string,
  nowMs = Date.now(),
): Promise<SocialCoopInviteRecord> {
  const row = await loadCoopInviteRow(db, inviteId);
  if (!row || row.invitee_id !== inviteeId) throw new Error('social_coop_invite_missing');
  if (row.status !== 'PENDING') throw new Error('social_coop_invite_not_pending');
  if (row.expires_at <= Math.floor(nowMs / 1000)) throw new Error('social_coop_invite_expired');
  if (await isEitherSocialBlocked(db, row.inviter_id, inviteeId)) throw new Error('social_blocked');
  return inviteRowToRecord(row);
}

export async function markSocialCoopInviteAccepted(db: D1Database, inviteeId: string, inviteId: string): Promise<void> {
  const write = await db.prepare(
    `UPDATE social_coop_invites SET status = 'ACCEPTED', responded_at = unixepoch()
     WHERE invite_id = ?1 AND invitee_id = ?2 AND status = 'PENDING'`,
  ).bind(inviteId, inviteeId).run();
  if ((write.meta.changes ?? 0) !== 1) throw new Error('social_coop_invite_accept_conflict');
}

export async function declineSocialCoopInvite(db: D1Database, inviteeId: string, inviteId: string): Promise<void> {
  const write = await db.prepare(
    `UPDATE social_coop_invites SET status = 'DECLINED', responded_at = unixepoch()
     WHERE invite_id = ?1 AND invitee_id = ?2 AND status = 'PENDING'`,
  ).bind(inviteId, inviteeId).run();
  if ((write.meta.changes ?? 0) !== 1) throw new Error('social_coop_invite_decline_conflict');
}

async function relationProfiles(db: D1Database, userIds: readonly string[], nowMs: number): Promise<readonly SocialPublicProfile[]> {
  const unique = [...new Set(userIds)].slice(0, 100);
  return Promise.all(unique.map((userId) => publicProfile(db, userId, nowMs)));
}

export async function getSocialSummary(db: D1Database, userId: string, nowMs = Date.now()): Promise<SocialSummary> {
  await touchSocialPresence(db, userId, nowMs);
  const [friendRows, incomingRows, outgoingRows, blockedRows, recentRows, inviteRows] = await Promise.all([
    db.prepare(`SELECT CASE WHEN user_low = ?1 THEN user_high ELSE user_low END AS user_id
                FROM social_friendships WHERE user_low = ?1 OR user_high = ?1 ORDER BY created_at DESC LIMIT 100`).bind(userId).all<UserIdRow>(),
    db.prepare('SELECT requester_id AS user_id FROM social_friend_requests WHERE addressee_id = ?1 ORDER BY created_at DESC LIMIT 100').bind(userId).all<UserIdRow>(),
    db.prepare('SELECT addressee_id AS user_id FROM social_friend_requests WHERE requester_id = ?1 ORDER BY created_at DESC LIMIT 100').bind(userId).all<UserIdRow>(),
    db.prepare('SELECT blocked_id AS user_id FROM social_blocks WHERE blocker_id = ?1 ORDER BY created_at DESC LIMIT 100').bind(userId).all<UserIdRow>(),
    db.prepare(`SELECT other_user_id, last_match_id, last_stage_id, play_count, last_played_at
                FROM social_recent_players WHERE user_id = ?1 ORDER BY last_played_at DESC LIMIT ?2`).bind(userId, SOCIAL_RECENT_PLAYER_LIMIT).all<RecentRow>(),
    db.prepare(`SELECT invite_id, inviter_id, invitee_id, match_id, stage_id, status, expires_at, created_at
                FROM social_coop_invites WHERE invitee_id = ?1 AND status = 'PENDING' AND expires_at > ?2
                ORDER BY created_at DESC LIMIT 20`).bind(userId, Math.floor(nowMs / 1000)).all<InviteRow>(),
  ]);

  const self = await publicProfile(db, userId, nowMs);
  const [friends, incomingRequests, outgoingRequests, blocked] = await Promise.all([
    relationProfiles(db, friendRows.results.map((row) => row.user_id), nowMs),
    relationProfiles(db, incomingRows.results.map((row) => row.user_id), nowMs),
    relationProfiles(db, outgoingRows.results.map((row) => row.user_id), nowMs),
    relationProfiles(db, blockedRows.results.map((row) => row.user_id), nowMs),
  ]);
  const recentPlayers = await Promise.all(recentRows.results.map(async (row): Promise<SocialRecentPlayer> => ({
    profile: await publicProfile(db, row.other_user_id, nowMs),
    lastMatchId: row.last_match_id,
    lastStageId: row.last_stage_id,
    playCount: row.play_count,
    lastPlayedAtMs: row.last_played_at * 1000,
    interactionAllowed: !await isEitherSocialBlocked(db, userId, row.other_user_id),
  })));
  const coopInvites = await Promise.all(inviteRows.results.map(async (row): Promise<SocialCoopInviteView> => ({
    inviteId: row.invite_id,
    inviter: await publicProfile(db, row.inviter_id, nowMs),
    matchId: row.match_id,
    stageId: row.stage_id,
    expiresAtMs: row.expires_at * 1000,
  })));
  return { self, friends, incomingRequests, outgoingRequests, blocked, recentPlayers, coopInvites };
}
