import type { Pvp2v2SeatId } from '@frontline/sim/pvp-2v2-playable';
import type { PvpTimedResult } from '@frontline/sim/pvp-content';
import { recordAccountAchievementFact } from './account-profile-authority.ts';
import { getAccountFriendlyPvp2v2SeatAuthority } from './account-pvp-authority.ts';
import { loadPvpMatch, loadPvpMatchParticipants } from './pvp-authority.ts';
import { isEitherSocialBlocked, recordRecentCoopPlayers } from './social-authority.ts';

export const FRIENDLY_2V2_SEAT_ORDER = ['A1', 'B1', 'A2', 'B2'] as const satisfies readonly Pvp2v2SeatId[];
export const FRIENDLY_2V2_LOBBY_TTL_MS = 10 * 60 * 1000;

export type FriendlyPvp2v2LobbyState = 'WAITING' | 'MATCHED' | 'CANCELLED' | 'EXPIRED';

interface FriendlyPvp2v2LobbyRow {
  readonly invite_code: string;
  readonly host_user_id: string;
  readonly participant_json: string;
  readonly state: FriendlyPvp2v2LobbyState;
  readonly match_id: string | null;
  readonly revision: number;
  readonly created_at: number;
  readonly expires_at: number;
  readonly updated_at: number;
}

export interface FriendlyPvp2v2LobbyView {
  readonly inviteCode: string;
  readonly hostAccountId: string;
  readonly participantAccountIds: readonly string[];
  readonly state: FriendlyPvp2v2LobbyState;
  readonly matchId: string | null;
  readonly revision: number;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
}

export interface FriendlyPvp2v2SeatAssignment {
  readonly accountId: string;
  readonly seatId: Pvp2v2SeatId;
  readonly teamId: 'A' | 'B';
  readonly seatIndex: 0 | 1;
}

function seconds(ms: number): number { return Math.floor(ms / 1000); }

export function normalizeFriendlyPvp2v2InviteCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return /^P2-[A-F0-9]{10}$/.test(normalized) ? normalized : null;
}

function parseParticipants(value: string): readonly string[] {
  let decoded: unknown;
  try { decoded = JSON.parse(value); } catch { throw new Error('friendly_2v2_participant_json_invalid'); }
  if (!Array.isArray(decoded) || decoded.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
    throw new Error('friendly_2v2_participant_json_invalid');
  }
  const participants = decoded.map((entry) => (entry as string).trim());
  if (participants.length < 1 || participants.length > 4 || new Set(participants).size !== participants.length) {
    throw new Error('friendly_2v2_participant_list_invalid');
  }
  return participants;
}

function toView(row: FriendlyPvp2v2LobbyRow): FriendlyPvp2v2LobbyView {
  return {
    inviteCode: row.invite_code,
    hostAccountId: row.host_user_id,
    participantAccountIds: parseParticipants(row.participant_json),
    state: row.state,
    matchId: row.match_id,
    revision: row.revision,
    createdAtMs: row.created_at * 1000,
    expiresAtMs: row.expires_at * 1000,
  };
}

async function loadRow(db: D1Database, inviteCode: string): Promise<FriendlyPvp2v2LobbyRow | null> {
  return db.prepare(
    `SELECT invite_code, host_user_id, participant_json, state, match_id, revision, created_at, expires_at, updated_at
     FROM pvp_friendly_2v2_lobbies WHERE invite_code = ?1`,
  ).bind(inviteCode).first<FriendlyPvp2v2LobbyRow>();
}

export async function loadFriendlyPvp2v2Lobby(
  db: D1Database,
  rawInviteCode: string,
  nowMs = Date.now(),
): Promise<FriendlyPvp2v2LobbyView | null> {
  const inviteCode = normalizeFriendlyPvp2v2InviteCode(rawInviteCode);
  if (!inviteCode) throw new Error('friendly_2v2_invite_code_invalid');
  let row = await loadRow(db, inviteCode);
  if (!row) return null;
  if (row.state === 'WAITING' && row.expires_at <= seconds(nowMs)) {
    await db.prepare(
      `UPDATE pvp_friendly_2v2_lobbies
       SET state = 'EXPIRED', revision = revision + 1, updated_at = ?1
       WHERE invite_code = ?2 AND state = 'WAITING' AND expires_at <= ?1`,
    ).bind(seconds(nowMs), inviteCode).run();
    row = await loadRow(db, inviteCode) ?? row;
  }
  return toView(row);
}

export async function createFriendlyPvp2v2Lobby(
  db: D1Database,
  inviteCode: string,
  hostAccountId: string,
  nowMs = Date.now(),
): Promise<FriendlyPvp2v2LobbyView> {
  const normalized = normalizeFriendlyPvp2v2InviteCode(inviteCode);
  if (!normalized) throw new Error('friendly_2v2_invite_code_invalid');
  await getAccountFriendlyPvp2v2SeatAuthority(db, hostAccountId, nowMs);
  const now = seconds(nowMs);
  const expires = seconds(nowMs + FRIENDLY_2V2_LOBBY_TTL_MS);
  const write = await db.prepare(
    `INSERT OR IGNORE INTO pvp_friendly_2v2_lobbies
      (invite_code, host_user_id, participant_json, state, match_id, revision, created_at, expires_at, updated_at)
     VALUES (?1, ?2, ?3, 'WAITING', NULL, 0, ?4, ?5, ?4)`,
  ).bind(normalized, hostAccountId, JSON.stringify([hostAccountId]), now, expires).run();
  if ((write.meta.changes ?? 0) !== 1) throw new Error('friendly_2v2_invite_code_collision');
  const row = await loadRow(db, normalized);
  if (!row) throw new Error('friendly_2v2_lobby_create_failed');
  return toView(row);
}

async function assertParticipantCompatible(
  db: D1Database,
  accountId: string,
  existingAccountIds: readonly string[],
): Promise<void> {
  for (const existing of existingAccountIds) {
    if (existing === accountId) continue;
    if (await isEitherSocialBlocked(db, accountId, existing)) throw new Error('friendly_2v2_blocked');
  }
}

export async function joinFriendlyPvp2v2Lobby(
  db: D1Database,
  rawInviteCode: string,
  accountId: string,
  nowMs = Date.now(),
): Promise<FriendlyPvp2v2LobbyView> {
  const inviteCode = normalizeFriendlyPvp2v2InviteCode(rawInviteCode);
  if (!inviteCode) throw new Error('friendly_2v2_invite_code_invalid');
  await getAccountFriendlyPvp2v2SeatAuthority(db, accountId, nowMs);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await loadFriendlyPvp2v2Lobby(db, inviteCode, nowMs);
    if (!current) throw new Error('friendly_2v2_lobby_not_found');
    if (current.state === 'EXPIRED') throw new Error('friendly_2v2_lobby_expired');
    if (current.state === 'CANCELLED') throw new Error('friendly_2v2_lobby_cancelled');
    if (current.participantAccountIds.includes(accountId)) return current;
    if (current.state !== 'WAITING' || current.participantAccountIds.length >= 4) throw new Error('friendly_2v2_lobby_full');
    await assertParticipantCompatible(db, accountId, current.participantAccountIds);
    const participants = [...current.participantAccountIds, accountId];
    const write = await db.prepare(
      `UPDATE pvp_friendly_2v2_lobbies
       SET participant_json = ?1, revision = revision + 1, updated_at = ?2
       WHERE invite_code = ?3 AND state = 'WAITING' AND revision = ?4`,
    ).bind(JSON.stringify(participants), seconds(nowMs), inviteCode, current.revision).run();
    if ((write.meta.changes ?? 0) !== 1) continue;
    const updated = await loadFriendlyPvp2v2Lobby(db, inviteCode, nowMs);
    if (!updated) throw new Error('friendly_2v2_lobby_disappeared');
    return updated;
  }
  throw new Error('friendly_2v2_lobby_revision_conflict');
}

export function getFriendlyPvp2v2Assignments(lobby: FriendlyPvp2v2LobbyView): readonly FriendlyPvp2v2SeatAssignment[] {
  return lobby.participantAccountIds.map((accountId, index) => {
    const seatId = FRIENDLY_2V2_SEAT_ORDER[index];
    if (!seatId) throw new Error('friendly_2v2_lobby_not_full');
    return { accountId, seatId, teamId: seatId[0] as 'A' | 'B', seatIndex: seatId[1] === '1' ? 0 : 1 };
  });
}

export async function ensureFriendlyPvp2v2DatabaseMatch(
  db: D1Database,
  lobby: FriendlyPvp2v2LobbyView,
  nowMs = Date.now(),
): Promise<FriendlyPvp2v2LobbyView> {
  if (lobby.participantAccountIds.length !== 4) return lobby;
  if (lobby.state === 'CANCELLED' || lobby.state === 'EXPIRED') return lobby;
  const assignments = getFriendlyPvp2v2Assignments(lobby);
  const matchId = `friendly2v2-${lobby.inviteCode}`;
  const existing = await loadPvpMatch(db, matchId);
  if (!existing) {
    const now = seconds(nowMs);
    await db.prepare(
      `INSERT OR IGNORE INTO pvp_matches
        (match_id, mode_id, season_id, state, result, created_at, started_at, completed_at)
       VALUES (?1, 'pvp_friendly_2v2', 'friendly', 'CREATED', NULL, ?2, NULL, NULL)`,
    ).bind(matchId, now).run();
    for (const assignment of assignments) {
      await db.prepare(
        `INSERT OR IGNORE INTO pvp_match_participants
          (match_id, user_id, team_id, seat_index, mmr_before, mmr_after)
         VALUES (?1, ?2, ?3, ?4, NULL, NULL)`,
      ).bind(matchId, assignment.accountId, assignment.teamId, assignment.seatIndex).run();
    }
  }
  const match = await loadPvpMatch(db, matchId);
  if (!match || match.mode_id !== 'pvp_friendly_2v2') throw new Error('friendly_2v2_match_create_failed');
  const participants = await loadPvpMatchParticipants(db, matchId);
  if (participants.length !== 4) throw new Error('friendly_2v2_match_participants_incomplete');
  await db.prepare(
    `UPDATE pvp_friendly_2v2_lobbies
     SET state = 'MATCHED', match_id = ?1, revision = revision + 1, updated_at = ?2
     WHERE invite_code = ?3 AND state = 'WAITING'`,
  ).bind(matchId, seconds(nowMs), lobby.inviteCode).run();
  const updated = await loadFriendlyPvp2v2Lobby(db, lobby.inviteCode, nowMs);
  if (!updated) throw new Error('friendly_2v2_lobby_disappeared');
  return updated;
}

export function getFriendlyPvp2v2SeatForAccount(
  lobby: FriendlyPvp2v2LobbyView,
  accountId: string,
): Pvp2v2SeatId | null {
  const index = lobby.participantAccountIds.indexOf(accountId);
  return index < 0 ? null : FRIENDLY_2V2_SEAT_ORDER[index] ?? null;
}

export async function cancelFriendlyPvp2v2Lobby(
  db: D1Database,
  rawInviteCode: string,
  accountId: string,
  nowMs = Date.now(),
): Promise<void> {
  const lobby = await loadFriendlyPvp2v2Lobby(db, rawInviteCode, nowMs);
  if (!lobby) return;
  if (lobby.hostAccountId !== accountId) throw new Error('friendly_2v2_host_only');
  if (lobby.state !== 'WAITING') throw new Error('friendly_2v2_lobby_not_cancellable');
  await db.prepare(
    `UPDATE pvp_friendly_2v2_lobbies
     SET state = 'CANCELLED', revision = revision + 1, updated_at = ?1
     WHERE invite_code = ?2 AND state = 'WAITING'`,
  ).bind(seconds(nowMs), lobby.inviteCode).run();
}

export async function settleFriendlyPvp2v2Match(
  db: D1Database,
  matchId: string,
  result: PvpTimedResult,
  nowMs = Date.now(),
): Promise<{ readonly matchId: string; readonly result: PvpTimedResult; readonly rated: false }> {
  const match = await loadPvpMatch(db, matchId);
  if (!match) throw new Error('friendly_2v2_match_not_found');
  if (match.mode_id !== 'pvp_friendly_2v2') throw new Error('friendly_2v2_match_mode_invalid');
  const freshlyCompleted = match.state !== 'COMPLETED';
  if (freshlyCompleted) {
    if (match.state !== 'CREATED' && match.state !== 'ACTIVE') throw new Error('friendly_2v2_match_not_completable');
    const write = await db.prepare(
      `UPDATE pvp_matches SET state = 'COMPLETED', result = ?1, completed_at = ?2
       WHERE match_id = ?3 AND state IN ('CREATED','ACTIVE')`,
    ).bind(result, seconds(nowMs), matchId).run();
    if ((write.meta.changes ?? 0) !== 1) throw new Error('friendly_2v2_result_conflict');
  }
  const participants = await loadPvpMatchParticipants(db, matchId);
  await Promise.all(participants.map((entry) => recordAccountAchievementFact(db, entry.user_id, 'pvp_first_friendly', nowMs)));
  if (freshlyCompleted) {
    for (let a = 0; a < participants.length; a += 1) {
      for (let b = a + 1; b < participants.length; b += 1) {
        await recordRecentCoopPlayers(db, participants[a]!.user_id, participants[b]!.user_id, matchId, 'PvP 2v2 친선전').catch(() => undefined);
      }
    }
  }
  return { matchId, result, rated: false };
}

export async function voidFriendlyPvp2v2Match(db: D1Database, matchId: string, nowMs = Date.now()): Promise<void> {
  const match = await loadPvpMatch(db, matchId);
  if (!match) return;
  if (match.mode_id !== 'pvp_friendly_2v2') throw new Error('friendly_2v2_match_mode_invalid');
  if (match.state === 'COMPLETED' || match.state === 'VOID') return;
  await db.prepare(
    `UPDATE pvp_matches SET state = 'VOID', completed_at = ?1
     WHERE match_id = ?2 AND state IN ('CREATED','ACTIVE')`,
  ).bind(seconds(nowMs), matchId).run();
}
