import {
  PVP_INITIAL_MMR,
  PVP_MATCHMAKING_WINDOWS,
  PVP_PLACEMENT_MATCH_COUNT,
  getPvpMatchmakingRadius,
  getPvpMode,
  getPvpTierForMmr,
  resolveDisplayedTier,
  resolveRankedPvpMmr,
  type PvpModeId,
  type PvpTierId,
  type PvpTimedResult,
} from '@frontline/sim/pvp-content';

export const PVP_CURRENT_SEASON_ID = 'preseason_v1';
export const PVP_PUBLIC_QUEUE_TTL_MS = 3 * 60 * 1000;
export const PVP_PUBLIC_MATCH_RETENTION_MS = 6 * 60 * 60 * 1000;

export type PublicPvpModeId = 'pvp_casual_1v1' | 'pvp_ranked_1v1' | 'pvp_casual_2v2';
export type PvpQueueState = 'QUEUED' | 'PAIRING' | 'MATCHED';
export type PvpMatchState = 'CREATED' | 'ACTIVE' | 'COMPLETED' | 'VOID' | 'EXPIRED';
export type PvpTeamId = 'A' | 'B';

export interface PvpRatingRow {
  readonly user_id: string;
  readonly season_id: string;
  readonly mmr: number;
  readonly best_mmr: number;
  readonly displayed_tier: PvpTierId;
  readonly placement_matches: number;
  readonly ranked_wins: number;
  readonly ranked_losses: number;
  readonly ranked_draws: number;
  readonly casual_wins: number;
  readonly casual_losses: number;
  readonly casual_draws: number;
  readonly revision: number;
  readonly updated_at: number;
}

export interface PvpRatingView {
  readonly seasonId: string;
  readonly mmr: number;
  readonly bestMmr: number;
  readonly displayedTier: PvpTierId;
  readonly placementMatches: number;
  readonly placementComplete: boolean;
  readonly rankedWins: number;
  readonly rankedLosses: number;
  readonly rankedDraws: number;
  readonly casualWins: number;
  readonly casualLosses: number;
  readonly casualDraws: number;
  readonly revision: number;
}

export interface PvpQueueRow {
  readonly user_id: string;
  readonly mode_id: PublicPvpModeId;
  readonly season_id: string;
  readonly mmr_snapshot: number;
  readonly state: PvpQueueState;
  readonly queued_at: number;
  readonly expires_at: number;
  readonly match_id: string | null;
  readonly team_id: PvpTeamId | null;
  readonly seat_index: 0 | 1 | null;
  readonly paired_at: number | null;
}

export interface PvpMatchRow {
  readonly match_id: string;
  readonly mode_id: PvpModeId;
  readonly season_id: string;
  readonly state: PvpMatchState;
  readonly result: PvpTimedResult | null;
  readonly created_at: number;
  readonly started_at: number | null;
  readonly completed_at: number | null;
}

export interface PvpMatchParticipantRow {
  readonly match_id: string;
  readonly user_id: string;
  readonly team_id: PvpTeamId;
  readonly seat_index: 0 | 1;
  readonly mmr_before: number | null;
  readonly mmr_after: number | null;
}

export interface PublicPvpMatchAssignment {
  readonly matchId: string;
  readonly modeId: PublicPvpModeId;
  readonly assignments: readonly {
    readonly userId: string;
    readonly teamId: PvpTeamId;
    readonly seatIndex: 0 | 1;
  }[];
}

function nonEmptyId(value: string, context: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 128) throw new Error(`${context} must be 1..128 characters`);
  return normalized;
}

function seconds(ms: number): number {
  return Math.floor(ms / 1000);
}

function assertPublicMode(modeId: PvpModeId): asserts modeId is PublicPvpModeId {
  if (modeId !== 'pvp_casual_1v1' && modeId !== 'pvp_ranked_1v1' && modeId !== 'pvp_casual_2v2') {
    throw new Error('pvp_mode_not_public_matchmaking');
  }
}

function queueSeats(modeId: PublicPvpModeId): readonly { teamId: PvpTeamId; seatIndex: 0 | 1 }[] {
  return modeId === 'pvp_casual_2v2'
    ? [
      { teamId: 'A', seatIndex: 0 },
      { teamId: 'A', seatIndex: 1 },
      { teamId: 'B', seatIndex: 0 },
      { teamId: 'B', seatIndex: 1 },
    ]
    : [
      { teamId: 'A', seatIndex: 0 },
      { teamId: 'B', seatIndex: 0 },
    ];
}

function ratingView(row: PvpRatingRow): PvpRatingView {
  return {
    seasonId: row.season_id,
    mmr: row.mmr,
    bestMmr: row.best_mmr,
    displayedTier: row.displayed_tier,
    placementMatches: row.placement_matches,
    placementComplete: row.placement_matches >= PVP_PLACEMENT_MATCH_COUNT,
    rankedWins: row.ranked_wins,
    rankedLosses: row.ranked_losses,
    rankedDraws: row.ranked_draws,
    casualWins: row.casual_wins,
    casualLosses: row.casual_losses,
    casualDraws: row.casual_draws,
    revision: row.revision,
  };
}

export async function loadPvpRating(db: D1Database, rawUserId: string): Promise<PvpRatingRow | null> {
  const userId = nonEmptyId(rawUserId, 'userId');
  return db.prepare(
    `SELECT user_id, season_id, mmr, best_mmr, displayed_tier, placement_matches,
            ranked_wins, ranked_losses, ranked_draws, casual_wins, casual_losses, casual_draws,
            revision, updated_at
     FROM pvp_ratings WHERE user_id = ?1`,
  ).bind(userId).first<PvpRatingRow>();
}

export async function ensurePvpRating(
  db: D1Database,
  rawUserId: string,
  nowMs = Date.now(),
): Promise<PvpRatingRow> {
  const userId = nonEmptyId(rawUserId, 'userId');
  const now = seconds(nowMs);
  await db.prepare(
    `INSERT INTO pvp_ratings
      (user_id, season_id, mmr, best_mmr, displayed_tier, placement_matches,
       ranked_wins, ranked_losses, ranked_draws, casual_wins, casual_losses, casual_draws,
       revision, updated_at)
     VALUES (?1, ?2, ?3, ?3, ?4, 0, 0, 0, 0, 0, 0, 0, 1, ?5)
     ON CONFLICT(user_id) DO NOTHING`,
  ).bind(userId, PVP_CURRENT_SEASON_ID, PVP_INITIAL_MMR, getPvpTierForMmr(PVP_INITIAL_MMR).id, now).run();
  const row = await loadPvpRating(db, userId);
  if (!row) throw new Error('pvp_rating_create_failed');
  return row;
}

export async function getPvpRatingView(db: D1Database, rawUserId: string, nowMs = Date.now()): Promise<PvpRatingView> {
  return ratingView(await ensurePvpRating(db, rawUserId, nowMs));
}

export async function loadPvpQueueRow(db: D1Database, rawUserId: string): Promise<PvpQueueRow | null> {
  const userId = nonEmptyId(rawUserId, 'userId');
  return db.prepare(
    `SELECT user_id, mode_id, season_id, mmr_snapshot, state, queued_at, expires_at,
            match_id, team_id, seat_index, paired_at
     FROM pvp_matchmaking_queue WHERE user_id = ?1`,
  ).bind(userId).first<PvpQueueRow>();
}

export async function clearExpiredPvpQueueRow(db: D1Database, rawUserId: string, nowMs = Date.now()): Promise<void> {
  const userId = nonEmptyId(rawUserId, 'userId');
  await db.prepare(
    `DELETE FROM pvp_matchmaking_queue
     WHERE user_id = ?1 AND expires_at <= ?2`,
  ).bind(userId, seconds(nowMs)).run();
}

export async function enterPublicPvpQueue(
  db: D1Database,
  rawUserId: string,
  modeId: PvpModeId,
  nowMs = Date.now(),
): Promise<PvpQueueRow> {
  assertPublicMode(modeId);
  const mode = getPvpMode(modeId);
  if (mode.queueKind !== 'PUBLIC') throw new Error('pvp_mode_not_public_matchmaking');
  const userId = nonEmptyId(rawUserId, 'userId');
  await clearExpiredPvpQueueRow(db, userId, nowMs);
  const existing = await loadPvpQueueRow(db, userId);
  if (existing && existing.state !== 'QUEUED') return existing;
  const rating = await ensurePvpRating(db, userId, nowMs);
  const now = seconds(nowMs);
  const expires = seconds(nowMs + PVP_PUBLIC_QUEUE_TTL_MS);
  await db.prepare(
    `INSERT INTO pvp_matchmaking_queue
      (user_id, mode_id, season_id, mmr_snapshot, state, queued_at, expires_at,
       match_id, team_id, seat_index, paired_at)
     VALUES (?1, ?2, ?3, ?4, 'QUEUED', ?5, ?6, NULL, NULL, NULL, NULL)
     ON CONFLICT(user_id) DO UPDATE SET
       mode_id = excluded.mode_id,
       season_id = excluded.season_id,
       mmr_snapshot = excluded.mmr_snapshot,
       queued_at = excluded.queued_at,
       expires_at = excluded.expires_at,
       match_id = NULL,
       team_id = NULL,
       seat_index = NULL,
       paired_at = NULL
     WHERE pvp_matchmaking_queue.state = 'QUEUED'`,
  ).bind(userId, modeId, rating.season_id, rating.mmr, now, expires).run();
  const row = await loadPvpQueueRow(db, userId);
  if (!row) throw new Error('pvp_queue_write_failed');
  return row;
}

async function blockExists(db: D1Database, userA: string, userB: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 AS blocked FROM social_blocks
     WHERE (blocker_id = ?1 AND blocked_id = ?2)
        OR (blocker_id = ?2 AND blocked_id = ?1)
     LIMIT 1`,
  ).bind(userA, userB).first<{ blocked: number }>();
  return row !== null;
}

async function candidatePool(
  db: D1Database,
  own: PvpQueueRow,
  nowMs: number,
  limit: number,
): Promise<readonly PvpQueueRow[]> {
  const ranked = own.mode_id === 'pvp_ranked_1v1';
  const waitSeconds = Math.max(0, seconds(nowMs) - own.queued_at);
  const radius = getPvpMatchmakingRadius(waitSeconds);
  const rows = await db.prepare(
    `SELECT user_id, mode_id, season_id, mmr_snapshot, state, queued_at, expires_at,
            match_id, team_id, seat_index, paired_at
     FROM pvp_matchmaking_queue
     WHERE user_id <> ?1
       AND mode_id = ?2
       AND season_id = ?3
       AND state = 'QUEUED'
       AND expires_at > ?4
       AND (?5 = 0 OR ABS(mmr_snapshot - ?6) <= ?7)
     ORDER BY queued_at ASC, ABS(mmr_snapshot - ?6) ASC, user_id ASC
     LIMIT ?8`,
  ).bind(
    own.user_id,
    own.mode_id,
    own.season_id,
    seconds(nowMs),
    ranked ? 1 : 0,
    own.mmr_snapshot,
    radius,
    limit,
  ).all<PvpQueueRow>();
  return rows.results;
}

async function selectCompatibleCandidates(
  db: D1Database,
  own: PvpQueueRow,
  nowMs: number,
): Promise<readonly PvpQueueRow[]> {
  const needed = queueSeats(own.mode_id).length - 1;
  const pool = await candidatePool(db, own, nowMs, Math.max(12, needed * 4));
  const accepted: PvpQueueRow[] = [];
  for (const candidate of pool) {
    if (await blockExists(db, own.user_id, candidate.user_id)) continue;
    let compatible = true;
    for (const previous of accepted) {
      if (await blockExists(db, previous.user_id, candidate.user_id)) {
        compatible = false;
        break;
      }
    }
    if (!compatible) continue;
    accepted.push(candidate);
    if (accepted.length >= needed) break;
  }
  return accepted;
}

export async function tryCreatePublicPvpMatch(
  db: D1Database,
  rawUserId: string,
  nowMs = Date.now(),
): Promise<PublicPvpMatchAssignment | null> {
  const userId = nonEmptyId(rawUserId, 'userId');
  const own = await loadPvpQueueRow(db, userId);
  if (!own || own.state !== 'QUEUED' || own.expires_at <= seconds(nowMs)) return null;
  const seats = queueSeats(own.mode_id);
  const candidates = await selectCompatibleCandidates(db, own, nowMs);
  if (candidates.length !== seats.length - 1) return null;
  const participants = [own, ...candidates];
  const matchId = crypto.randomUUID();
  const pairedAt = seconds(nowMs);
  const writes = await db.batch(participants.map((participant, index) => {
    const seat = seats[index]!;
    return db.prepare(
      `UPDATE pvp_matchmaking_queue
       SET state = 'PAIRING', match_id = ?1, team_id = ?2, seat_index = ?3, paired_at = ?4
       WHERE user_id = ?5 AND mode_id = ?6 AND season_id = ?7
         AND state = 'QUEUED' AND expires_at > ?4`,
    ).bind(matchId, seat.teamId, seat.seatIndex, pairedAt, participant.user_id, own.mode_id, own.season_id);
  }));
  if (writes.some((write) => (write.meta.changes ?? 0) !== 1)) {
    await db.prepare(
      `UPDATE pvp_matchmaking_queue
       SET state = 'QUEUED', match_id = NULL, team_id = NULL, seat_index = NULL, paired_at = NULL
       WHERE match_id = ?1 AND state = 'PAIRING'`,
    ).bind(matchId).run();
    return null;
  }

  const createdAt = seconds(nowMs);
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO pvp_matches (match_id, mode_id, season_id, state, result, created_at, started_at, completed_at)
       VALUES (?1, ?2, ?3, 'CREATED', NULL, ?4, NULL, NULL)`,
    ).bind(matchId, own.mode_id, own.season_id, createdAt),
  ];
  const assignments = participants.map((participant, index) => {
    const seat = seats[index]!;
    statements.push(db.prepare(
      `INSERT INTO pvp_match_participants
        (match_id, user_id, team_id, seat_index, mmr_before, mmr_after)
       VALUES (?1, ?2, ?3, ?4, ?5, NULL)`,
    ).bind(matchId, participant.user_id, seat.teamId, seat.seatIndex, participant.mmr_snapshot));
    return { userId: participant.user_id, teamId: seat.teamId, seatIndex: seat.seatIndex } as const;
  });
  try {
    await db.batch(statements);
    await db.prepare(
      `UPDATE pvp_matchmaking_queue SET state = 'MATCHED', expires_at = ?1
       WHERE match_id = ?2 AND state = 'PAIRING'`,
    ).bind(seconds(nowMs + PVP_PUBLIC_MATCH_RETENTION_MS), matchId).run();
  } catch (error) {
    await db.prepare(`DELETE FROM pvp_matches WHERE match_id = ?1`).bind(matchId).run().catch(() => undefined);
    await db.prepare(
      `UPDATE pvp_matchmaking_queue
       SET state = 'QUEUED', match_id = NULL, team_id = NULL, seat_index = NULL, paired_at = NULL,
           expires_at = ?1
       WHERE match_id = ?2`,
    ).bind(seconds(nowMs + PVP_PUBLIC_QUEUE_TTL_MS), matchId).run().catch(() => undefined);
    throw error;
  }
  return { matchId, modeId: own.mode_id, assignments };
}

export async function leavePublicPvpQueue(
  db: D1Database,
  rawUserId: string,
): Promise<'IDLE' | 'LEFT' | 'ALREADY_MATCHED'> {
  const userId = nonEmptyId(rawUserId, 'userId');
  const row = await loadPvpQueueRow(db, userId);
  if (!row) return 'IDLE';
  if (row.state !== 'QUEUED') return 'ALREADY_MATCHED';
  await db.prepare(`DELETE FROM pvp_matchmaking_queue WHERE user_id = ?1 AND state = 'QUEUED'`).bind(userId).run();
  return 'LEFT';
}

export async function loadPvpMatch(db: D1Database, rawMatchId: string): Promise<PvpMatchRow | null> {
  const matchId = nonEmptyId(rawMatchId, 'matchId');
  return db.prepare(
    `SELECT match_id, mode_id, season_id, state, result, created_at, started_at, completed_at
     FROM pvp_matches WHERE match_id = ?1`,
  ).bind(matchId).first<PvpMatchRow>();
}

export async function loadPvpMatchParticipants(
  db: D1Database,
  rawMatchId: string,
): Promise<readonly PvpMatchParticipantRow[]> {
  const matchId = nonEmptyId(rawMatchId, 'matchId');
  const rows = await db.prepare(
    `SELECT match_id, user_id, team_id, seat_index, mmr_before, mmr_after
     FROM pvp_match_participants
     WHERE match_id = ?1
     ORDER BY team_id ASC, seat_index ASC, user_id ASC`,
  ).bind(matchId).all<PvpMatchParticipantRow>();
  return rows.results;
}

export async function markPvpMatchActive(db: D1Database, rawMatchId: string, nowMs = Date.now()): Promise<boolean> {
  const matchId = nonEmptyId(rawMatchId, 'matchId');
  const write = await db.prepare(
    `UPDATE pvp_matches SET state = 'ACTIVE', started_at = ?1
     WHERE match_id = ?2 AND state = 'CREATED'`,
  ).bind(seconds(nowMs), matchId).run();
  return (write.meta.changes ?? 0) === 1;
}

function rankedDeltaColumns(result: PvpTimedResult, teamId: PvpTeamId): { wins: number; losses: number; draws: number } {
  if (result === 'DRAW') return { wins: 0, losses: 0, draws: 1 };
  const won = result === teamId;
  return won ? { wins: 1, losses: 0, draws: 0 } : { wins: 0, losses: 1, draws: 0 };
}

export interface CompletedRankedPvpResult {
  readonly matchId: string;
  readonly result: PvpTimedResult;
  readonly a: PvpRatingView;
  readonly b: PvpRatingView;
}

/**
 * Internal trusted result mutation. Public HTTP must only call this after the
 * authoritative PvP room has produced the terminal result; clients never submit MMR.
 */
export async function completeRankedPvpMatch(
  db: D1Database,
  rawMatchId: string,
  result: PvpTimedResult,
  nowMs = Date.now(),
): Promise<CompletedRankedPvpResult> {
  const matchId = nonEmptyId(rawMatchId, 'matchId');
  const match = await loadPvpMatch(db, matchId);
  if (!match) throw new Error('pvp_match_not_found');
  if (match.mode_id !== 'pvp_ranked_1v1') throw new Error('pvp_match_not_ranked_1v1');
  if (match.state === 'COMPLETED') {
    const participants = await loadPvpMatchParticipants(db, matchId);
    const aParticipant = participants.find((entry) => entry.team_id === 'A');
    const bParticipant = participants.find((entry) => entry.team_id === 'B');
    if (!aParticipant || !bParticipant) throw new Error('pvp_match_participants_missing');
    return {
      matchId,
      result: match.result ?? result,
      a: ratingView(await ensurePvpRating(db, aParticipant.user_id, nowMs)),
      b: ratingView(await ensurePvpRating(db, bParticipant.user_id, nowMs)),
    };
  }
  if (match.state !== 'CREATED' && match.state !== 'ACTIVE') throw new Error('pvp_match_not_completable');
  const participants = await loadPvpMatchParticipants(db, matchId);
  if (participants.length !== 2) throw new Error('pvp_ranked_participant_count_invalid');
  const aParticipant = participants.find((entry) => entry.team_id === 'A' && entry.seat_index === 0);
  const bParticipant = participants.find((entry) => entry.team_id === 'B' && entry.seat_index === 0);
  if (!aParticipant || !bParticipant) throw new Error('pvp_ranked_seats_invalid');
  const aRating = await ensurePvpRating(db, aParticipant.user_id, nowMs);
  const bRating = await ensurePvpRating(db, bParticipant.user_id, nowMs);
  if (aRating.season_id !== match.season_id || bRating.season_id !== match.season_id) throw new Error('pvp_season_changed_mid_match');
  const resolved = resolveRankedPvpMmr(
    aRating.mmr,
    bRating.mmr,
    result,
    aRating.placement_matches,
    bRating.placement_matches,
  );
  const aBest = Math.max(aRating.best_mmr, resolved.a.newMmr);
  const bBest = Math.max(bRating.best_mmr, resolved.b.newMmr);
  const aTier = resolveDisplayedTier(aRating.displayed_tier, resolved.a.newMmr).id;
  const bTier = resolveDisplayedTier(bRating.displayed_tier, resolved.b.newMmr).id;
  const aRecord = rankedDeltaColumns(result, 'A');
  const bRecord = rankedDeltaColumns(result, 'B');
  const now = seconds(nowMs);
  const aPlacement = Math.min(PVP_PLACEMENT_MATCH_COUNT, aRating.placement_matches + 1);
  const bPlacement = Math.min(PVP_PLACEMENT_MATCH_COUNT, bRating.placement_matches + 1);
  const writes = await db.batch([
    db.prepare(
      `UPDATE pvp_matches
       SET state = 'COMPLETED', result = ?1, completed_at = ?2
       WHERE match_id = ?3 AND state IN ('CREATED','ACTIVE')`,
    ).bind(result, now, matchId),
    db.prepare(
      `UPDATE pvp_match_participants SET mmr_after = ?1
       WHERE match_id = ?2 AND user_id = ?3`,
    ).bind(resolved.a.newMmr, matchId, aRating.user_id),
    db.prepare(
      `UPDATE pvp_match_participants SET mmr_after = ?1
       WHERE match_id = ?2 AND user_id = ?3`,
    ).bind(resolved.b.newMmr, matchId, bRating.user_id),
    db.prepare(
      `UPDATE pvp_ratings SET
         mmr = ?1, best_mmr = ?2, displayed_tier = ?3, placement_matches = ?4,
         ranked_wins = ranked_wins + ?5, ranked_losses = ranked_losses + ?6, ranked_draws = ranked_draws + ?7,
         revision = revision + 1, updated_at = ?8
       WHERE user_id = ?9 AND revision = ?10`,
    ).bind(
      resolved.a.newMmr, aBest, aTier, aPlacement,
      aRecord.wins, aRecord.losses, aRecord.draws,
      now, aRating.user_id, aRating.revision,
    ),
    db.prepare(
      `UPDATE pvp_ratings SET
         mmr = ?1, best_mmr = ?2, displayed_tier = ?3, placement_matches = ?4,
         ranked_wins = ranked_wins + ?5, ranked_losses = ranked_losses + ?6, ranked_draws = ranked_draws + ?7,
         revision = revision + 1, updated_at = ?8
       WHERE user_id = ?9 AND revision = ?10`,
    ).bind(
      resolved.b.newMmr, bBest, bTier, bPlacement,
      bRecord.wins, bRecord.losses, bRecord.draws,
      now, bRating.user_id, bRating.revision,
    ),
  ]);
  if (writes.some((write) => (write.meta.changes ?? 0) !== 1)) throw new Error('pvp_ranked_result_conflict');
  await db.prepare(`DELETE FROM pvp_matchmaking_queue WHERE match_id = ?1`).bind(matchId).run();
  return {
    matchId,
    result,
    a: ratingView((await loadPvpRating(db, aRating.user_id))!),
    b: ratingView((await loadPvpRating(db, bRating.user_id))!),
  };
}

export interface PvpLeaderboardEntry {
  readonly userId: string;
  readonly displayName: string;
  readonly mmr: number;
  readonly displayedTier: PvpTierId;
  readonly rankedWins: number;
  readonly rank: number;
}

export async function getPvpLeaderboard(
  db: D1Database,
  limit = 100,
): Promise<readonly PvpLeaderboardEntry[]> {
  const safeLimit = Math.max(1, Math.min(1000, Math.trunc(limit)));
  const rows = await db.prepare(
    `SELECT r.user_id, p.display_name, r.mmr, r.displayed_tier, r.ranked_wins
     FROM pvp_ratings r
     JOIN social_profiles p ON p.user_id = r.user_id
     WHERE r.season_id = ?1 AND r.placement_matches >= ?2
     ORDER BY r.mmr DESC, r.ranked_wins DESC, r.updated_at ASC, r.user_id ASC
     LIMIT ?3`,
  ).bind(PVP_CURRENT_SEASON_ID, PVP_PLACEMENT_MATCH_COUNT, safeLimit).all<{
    user_id: string;
    display_name: string;
    mmr: number;
    displayed_tier: PvpTierId;
    ranked_wins: number;
  }>();
  return rows.results.map((row, index) => ({
    userId: row.user_id,
    displayName: row.display_name,
    mmr: row.mmr,
    displayedTier: row.displayed_tier,
    rankedWins: row.ranked_wins,
    rank: index + 1,
  }));
}

export const __pvpAuthorityTestOnly = {
  queueSeats,
  ratingView,
  rankedDeltaColumns,
  matchmakingWindows: PVP_MATCHMAKING_WINDOWS,
};
