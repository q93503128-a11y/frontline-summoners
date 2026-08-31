import { getAccountFriendlyPvp2v2SeatAuthority } from './account-pvp-authority.ts';
import { loadFriendlyPvp2v2Lobby } from './pvp-friendly-2v2-authority.ts';
import { areSocialFriends, isEitherSocialBlocked } from './social-authority.ts';

export const SOCIAL_PVP_2V2_INVITE_TTL_SECONDS = 10 * 60;

export interface SocialPvp2v2InviteRecord {
  readonly inviteId: string;
  readonly hostId: string;
  readonly inviteeId: string;
  readonly inviteCode: string;
  readonly modeId: 'pvp_friendly_2v2';
  readonly status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  readonly expiresAtMs: number;
  readonly createdAtMs: number;
}

type InviteRow = {
  readonly invite_id: string;
  readonly host_id: string;
  readonly invitee_id: string;
  readonly invite_code: string;
  readonly status: SocialPvp2v2InviteRecord['status'];
  readonly expires_at: number;
  readonly created_at: number;
};

function id(value: string, context: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 128) throw new Error(`${context} must be 1..128 characters`);
  return normalized;
}

function toRecord(row: InviteRow): SocialPvp2v2InviteRecord {
  return {
    inviteId: row.invite_id,
    hostId: row.host_id,
    inviteeId: row.invitee_id,
    inviteCode: row.invite_code,
    modeId: 'pvp_friendly_2v2',
    status: row.status,
    expiresAtMs: row.expires_at * 1000,
    createdAtMs: row.created_at * 1000,
  };
}

async function loadRow(db: D1Database, inviteId: string): Promise<InviteRow | null> {
  return db.prepare(
    `SELECT invite_id, host_id, invitee_id, invite_code, status, expires_at, created_at
     FROM social_pvp_2v2_invites WHERE invite_id = ?1`,
  ).bind(inviteId).first<InviteRow>();
}

export async function createSocialPvp2v2Invite(
  db: D1Database,
  rawHostId: string,
  rawInviteeId: string,
  rawInviteCode: string,
  nowMs = Date.now(),
): Promise<SocialPvp2v2InviteRecord> {
  const hostId = id(rawHostId, 'hostId');
  const inviteeId = id(rawInviteeId, 'inviteeId');
  const inviteCode = id(rawInviteCode, 'inviteCode');
  if (hostId === inviteeId) throw new Error('social_self_target');
  if (!await areSocialFriends(db, hostId, inviteeId)) throw new Error('social_friend_required');
  if (await isEitherSocialBlocked(db, hostId, inviteeId)) throw new Error('social_blocked');

  const lobby = await loadFriendlyPvp2v2Lobby(db, inviteCode, nowMs);
  if (!lobby) throw new Error('friendly_2v2_lobby_not_found');
  if (lobby.hostAccountId !== hostId) throw new Error('friendly_2v2_host_only');
  if (lobby.state === 'EXPIRED') throw new Error('friendly_2v2_lobby_expired');
  if (lobby.state === 'CANCELLED') throw new Error('friendly_2v2_lobby_cancelled');
  if (lobby.state !== 'WAITING' || lobby.participantAccountIds.length >= 4) throw new Error('friendly_2v2_lobby_full');
  if (lobby.participantAccountIds.includes(inviteeId)) throw new Error('social_pvp_2v2_already_joined');

  // Fail before sending a notification if the invited account cannot occupy a 2v2 seat.
  await getAccountFriendlyPvp2v2SeatAuthority(db, inviteeId, nowMs);

  const now = Math.floor(nowMs / 1000);
  const expiresAt = Math.min(Math.floor(lobby.expiresAtMs / 1000), now + SOCIAL_PVP_2V2_INVITE_TTL_SECONDS);
  if (expiresAt <= now) throw new Error('social_pvp_2v2_invite_expiry_invalid');
  await db.prepare(
    `UPDATE social_pvp_2v2_invites SET status = 'CANCELLED', responded_at = ?1
     WHERE host_id = ?2 AND invitee_id = ?3 AND invite_code = ?4
       AND status = 'PENDING' AND expires_at <= ?1`,
  ).bind(now, hostId, inviteeId, inviteCode).run();
  const pending = await db.prepare(
    `SELECT invite_id FROM social_pvp_2v2_invites
     WHERE host_id = ?1 AND invitee_id = ?2 AND invite_code = ?3
       AND status = 'PENDING' AND expires_at > ?4 LIMIT 1`,
  ).bind(hostId, inviteeId, inviteCode, now).first<{ invite_id: string }>();
  if (pending) throw new Error('social_pvp_2v2_invite_pending');

  const inviteId = crypto.randomUUID();
  const write = await db.prepare(
    `INSERT INTO social_pvp_2v2_invites
      (invite_id, host_id, invitee_id, invite_code, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  ).bind(inviteId, hostId, inviteeId, inviteCode, expiresAt).run();
  if ((write.meta.changes ?? 0) !== 1) throw new Error('social_pvp_2v2_invite_insert_failed');
  const row = await loadRow(db, inviteId);
  if (!row) throw new Error('social_pvp_2v2_invite_missing_after_insert');
  return toRecord(row);
}

export async function getIncomingSocialPvp2v2Invites(
  db: D1Database,
  rawInviteeId: string,
  nowMs = Date.now(),
  limit = 20,
): Promise<readonly SocialPvp2v2InviteRecord[]> {
  const inviteeId = id(rawInviteeId, 'inviteeId');
  const now = Math.floor(nowMs / 1000);
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const rows = await db.prepare(
    `SELECT i.invite_id, i.host_id, i.invitee_id, i.invite_code, i.status, i.expires_at, i.created_at
     FROM social_pvp_2v2_invites i
     JOIN pvp_friendly_2v2_lobbies l ON l.invite_code = i.invite_code
     WHERE i.invitee_id = ?1 AND i.status = 'PENDING' AND i.expires_at > ?2
       AND l.state = 'WAITING' AND l.expires_at > ?2
     ORDER BY i.created_at DESC LIMIT ?3`,
  ).bind(inviteeId, now, safeLimit).all<InviteRow>();
  const visible: SocialPvp2v2InviteRecord[] = [];
  for (const row of rows.results) {
    if (!await isEitherSocialBlocked(db, row.host_id, inviteeId)) visible.push(toRecord(row));
  }
  return visible;
}

export async function getPendingSocialPvp2v2InviteForInvitee(
  db: D1Database,
  rawInviteeId: string,
  rawInviteId: string,
  nowMs = Date.now(),
): Promise<SocialPvp2v2InviteRecord> {
  const inviteeId = id(rawInviteeId, 'inviteeId');
  const inviteId = id(rawInviteId, 'inviteId');
  const row = await loadRow(db, inviteId);
  if (!row || row.invitee_id !== inviteeId) throw new Error('social_pvp_2v2_invite_missing');
  if (row.status !== 'PENDING') throw new Error('social_pvp_2v2_invite_not_pending');
  if (row.expires_at <= Math.floor(nowMs / 1000)) throw new Error('social_pvp_2v2_invite_expired');
  if (await isEitherSocialBlocked(db, row.host_id, inviteeId)) throw new Error('social_blocked');
  if (!await areSocialFriends(db, row.host_id, inviteeId)) throw new Error('social_friend_required');
  const lobby = await loadFriendlyPvp2v2Lobby(db, row.invite_code, nowMs);
  if (!lobby) throw new Error('friendly_2v2_lobby_not_found');
  if (lobby.hostAccountId !== row.host_id) throw new Error('social_pvp_2v2_host_mismatch');
  if (lobby.state === 'EXPIRED') throw new Error('friendly_2v2_lobby_expired');
  if (lobby.state === 'CANCELLED') throw new Error('friendly_2v2_lobby_cancelled');
  if (lobby.state !== 'WAITING' || lobby.participantAccountIds.length >= 4) throw new Error('friendly_2v2_lobby_full');
  return toRecord(row);
}

export async function markSocialPvp2v2InviteAccepted(db: D1Database, inviteeId: string, inviteId: string): Promise<void> {
  const write = await db.prepare(
    `UPDATE social_pvp_2v2_invites SET status = 'ACCEPTED', responded_at = unixepoch()
     WHERE invite_id = ?1 AND invitee_id = ?2 AND status = 'PENDING'`,
  ).bind(inviteId, inviteeId).run();
  if ((write.meta.changes ?? 0) !== 1) throw new Error('social_pvp_2v2_invite_accept_conflict');
}

export async function declineSocialPvp2v2Invite(
  db: D1Database,
  inviteeId: string,
  inviteId: string,
  nowMs = Date.now(),
): Promise<void> {
  await getPendingSocialPvp2v2InviteForInvitee(db, inviteeId, inviteId, nowMs);
  const write = await db.prepare(
    `UPDATE social_pvp_2v2_invites SET status = 'DECLINED', responded_at = unixepoch()
     WHERE invite_id = ?1 AND invitee_id = ?2 AND status = 'PENDING'`,
  ).bind(inviteId, inviteeId).run();
  if ((write.meta.changes ?? 0) !== 1) throw new Error('social_pvp_2v2_invite_decline_conflict');
}

export async function cancelPendingSocialPvp2v2InvitesForLobby(
  db: D1Database,
  hostId: string,
  inviteCode: string,
): Promise<void> {
  await db.prepare(
    `UPDATE social_pvp_2v2_invites SET status = 'CANCELLED', responded_at = unixepoch()
     WHERE host_id = ?1 AND invite_code = ?2 AND status = 'PENDING'`,
  ).bind(hostId, inviteCode).run();
}
