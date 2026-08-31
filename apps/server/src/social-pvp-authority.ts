import type { FriendlyPvpGrowthPolicy } from './pvp-friendly-authority.ts';
import { areSocialFriends, isEitherSocialBlocked } from './social-authority.ts';

export const SOCIAL_PVP_INVITE_TTL_SECONDS = 10 * 60;

export interface SocialPvpInviteRecord {
  readonly inviteId: string;
  readonly inviterId: string;
  readonly inviteeId: string;
  readonly inviteCode: string;
  readonly modeId: 'pvp_friendly_1v1';
  readonly growthPolicy: FriendlyPvpGrowthPolicy;
  readonly status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  readonly expiresAtMs: number;
  readonly createdAtMs: number;
}

export interface SocialPvpInviterSummary {
  readonly friendCode: string;
  readonly displayName: string;
  readonly online: boolean;
}

type SocialPvpInviteRow = {
  readonly invite_id: string;
  readonly inviter_id: string;
  readonly invitee_id: string;
  readonly invite_code: string;
  readonly mode_id: 'pvp_friendly_1v1';
  readonly growth_policy: FriendlyPvpGrowthPolicy;
  readonly status: SocialPvpInviteRecord['status'];
  readonly expires_at: number;
  readonly created_at: number;
};

function nonEmptyId(value: string, context: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 128) throw new Error(`${context} must be 1..128 characters`);
  return normalized;
}

function toRecord(row: SocialPvpInviteRow): SocialPvpInviteRecord {
  return {
    inviteId: row.invite_id,
    inviterId: row.inviter_id,
    inviteeId: row.invitee_id,
    inviteCode: row.invite_code,
    modeId: row.mode_id,
    growthPolicy: row.growth_policy,
    status: row.status,
    expiresAtMs: row.expires_at * 1000,
    createdAtMs: row.created_at * 1000,
  };
}

async function loadRow(db: D1Database, inviteId: string): Promise<SocialPvpInviteRow | null> {
  return db.prepare(
    `SELECT invite_id, inviter_id, invitee_id, invite_code, mode_id, growth_policy, status, expires_at, created_at
     FROM social_pvp_invites WHERE invite_id = ?1`,
  ).bind(inviteId).first<SocialPvpInviteRow>();
}

export async function getSocialPvpInviterSummary(
  db: D1Database,
  rawUserId: string,
  nowMs = Date.now(),
): Promise<SocialPvpInviterSummary> {
  const userId = nonEmptyId(rawUserId, 'userId');
  const row = await db.prepare(
    'SELECT friend_code, display_name, online_until FROM social_profiles WHERE user_id = ?1',
  ).bind(userId).first<{ friend_code: string; display_name: string; online_until: number }>();
  if (!row) throw new Error('social_profile_missing');
  return {
    friendCode: row.friend_code,
    displayName: row.display_name,
    online: row.online_until > Math.floor(nowMs / 1000),
  };
}

export async function createSocialPvpInvite(
  db: D1Database,
  rawInviterId: string,
  rawInviteeId: string,
  inviteCode: string,
  growthPolicy: FriendlyPvpGrowthPolicy,
  expiresAtMs: number,
  nowMs = Date.now(),
): Promise<SocialPvpInviteRecord> {
  const inviterId = nonEmptyId(rawInviterId, 'inviterId');
  const inviteeId = nonEmptyId(rawInviteeId, 'inviteeId');
  if (inviterId === inviteeId) throw new Error('social_self_target');
  if (!await areSocialFriends(db, inviterId, inviteeId)) throw new Error('social_friend_required');
  if (await isEitherSocialBlocked(db, inviterId, inviteeId)) throw new Error('social_blocked');
  const now = Math.floor(nowMs / 1000);
  const expiresAt = Math.floor(expiresAtMs / 1000);
  if (expiresAt <= now) throw new Error('social_pvp_invite_expiry_invalid');

  await db.prepare(
    `UPDATE social_pvp_invites SET status = 'CANCELLED', responded_at = ?1
     WHERE inviter_id = ?2 AND invitee_id = ?3 AND mode_id = 'pvp_friendly_1v1'
       AND status = 'PENDING' AND expires_at <= ?1`,
  ).bind(now, inviterId, inviteeId).run();
  const pending = await db.prepare(
    `SELECT invite_id FROM social_pvp_invites
     WHERE inviter_id = ?1 AND invitee_id = ?2 AND mode_id = 'pvp_friendly_1v1'
       AND status = 'PENDING' AND expires_at > ?3 LIMIT 1`,
  ).bind(inviterId, inviteeId, now).first<{ invite_id: string }>();
  if (pending) throw new Error('social_pvp_invite_pending');

  const inviteId = crypto.randomUUID();
  const write = await db.prepare(
    `INSERT INTO social_pvp_invites
      (invite_id, inviter_id, invitee_id, invite_code, mode_id, growth_policy, expires_at)
     VALUES (?1, ?2, ?3, ?4, 'pvp_friendly_1v1', ?5, ?6)`,
  ).bind(inviteId, inviterId, inviteeId, inviteCode, growthPolicy, expiresAt).run();
  if ((write.meta.changes ?? 0) !== 1) throw new Error('social_pvp_invite_insert_failed');
  const row = await loadRow(db, inviteId);
  if (!row) throw new Error('social_pvp_invite_missing_after_insert');
  return toRecord(row);
}

export async function getIncomingSocialPvpInvites(
  db: D1Database,
  rawInviteeId: string,
  nowMs = Date.now(),
  limit = 20,
): Promise<readonly SocialPvpInviteRecord[]> {
  const inviteeId = nonEmptyId(rawInviteeId, 'inviteeId');
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const now = Math.floor(nowMs / 1000);
  const rows = await db.prepare(
    `SELECT invite_id, inviter_id, invitee_id, invite_code, mode_id, growth_policy, status, expires_at, created_at
     FROM social_pvp_invites
     WHERE invitee_id = ?1 AND status = 'PENDING' AND expires_at > ?2
     ORDER BY created_at DESC LIMIT ?3`,
  ).bind(inviteeId, now, safeLimit).all<SocialPvpInviteRow>();
  const visible: SocialPvpInviteRecord[] = [];
  for (const row of rows.results) {
    if (!await isEitherSocialBlocked(db, row.inviter_id, inviteeId)) visible.push(toRecord(row));
  }
  return visible;
}

export async function getPendingSocialPvpInviteForInvitee(
  db: D1Database,
  rawInviteeId: string,
  rawInviteId: string,
  nowMs = Date.now(),
): Promise<SocialPvpInviteRecord> {
  const inviteeId = nonEmptyId(rawInviteeId, 'inviteeId');
  const inviteId = nonEmptyId(rawInviteId, 'inviteId');
  const row = await loadRow(db, inviteId);
  if (!row || row.invitee_id !== inviteeId) throw new Error('social_pvp_invite_missing');
  if (row.status !== 'PENDING') throw new Error('social_pvp_invite_not_pending');
  if (row.expires_at <= Math.floor(nowMs / 1000)) throw new Error('social_pvp_invite_expired');
  if (await isEitherSocialBlocked(db, row.inviter_id, inviteeId)) throw new Error('social_blocked');
  if (!await areSocialFriends(db, row.inviter_id, inviteeId)) throw new Error('social_friend_required');
  return toRecord(row);
}

export async function markSocialPvpInviteAccepted(db: D1Database, inviteeId: string, inviteId: string): Promise<void> {
  const write = await db.prepare(
    `UPDATE social_pvp_invites SET status = 'ACCEPTED', responded_at = unixepoch()
     WHERE invite_id = ?1 AND invitee_id = ?2 AND status = 'PENDING'`,
  ).bind(inviteId, inviteeId).run();
  if ((write.meta.changes ?? 0) !== 1) throw new Error('social_pvp_invite_accept_conflict');
}

export async function declineSocialPvpInvite(db: D1Database, inviteeId: string, inviteId: string): Promise<SocialPvpInviteRecord> {
  const current = await getPendingSocialPvpInviteForInvitee(db, inviteeId, inviteId);
  const write = await db.prepare(
    `UPDATE social_pvp_invites SET status = 'DECLINED', responded_at = unixepoch()
     WHERE invite_id = ?1 AND invitee_id = ?2 AND status = 'PENDING'`,
  ).bind(inviteId, inviteeId).run();
  if ((write.meta.changes ?? 0) !== 1) throw new Error('social_pvp_invite_decline_conflict');
  return { ...current, status: 'DECLINED' };
}

export async function cancelSocialPvpInviteByInviter(db: D1Database, inviterId: string, inviteId: string): Promise<SocialPvpInviteRecord> {
  const row = await loadRow(db, inviteId);
  if (!row || row.inviter_id !== inviterId) throw new Error('social_pvp_invite_missing');
  if (row.status !== 'PENDING') throw new Error('social_pvp_invite_not_pending');
  const write = await db.prepare(
    `UPDATE social_pvp_invites SET status = 'CANCELLED', responded_at = unixepoch()
     WHERE invite_id = ?1 AND inviter_id = ?2 AND status = 'PENDING'`,
  ).bind(inviteId, inviterId).run();
  if ((write.meta.changes ?? 0) !== 1) throw new Error('social_pvp_invite_cancel_conflict');
  return { ...toRecord(row), status: 'CANCELLED' };
}
