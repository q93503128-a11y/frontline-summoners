import { PVP_CURRENT_SEASON_ID } from './pvp-authority.ts';
import {
  finalizePvpSeason,
  rollClosedPvpSeasonToCurrent,
  type PvpSeasonClosure,
} from './pvp-season-authority.ts';

export type PvpSeasonOperationState = 'OPEN' | 'DRAINING' | 'CLOSED_PENDING_DEPLOY';

export interface PvpSeasonOperationsSnapshot {
  readonly codeSeasonId: string;
  readonly seasonId: string;
  readonly state: PvpSeasonOperationState;
  readonly queueOpen: boolean;
  readonly nextSeasonId: string | null;
  readonly startedAtMs: number | null;
  readonly finalizedAtMs: number | null;
  readonly revision: number;
  readonly liveMatches: number;
  readonly liveQueueEntries: number;
  readonly closure: PvpSeasonClosure | null;
  readonly readyToFinalize: boolean;
  readonly deployNextSeasonRequired: boolean;
  readonly readyToRoll: boolean;
}

type OperationRow = {
  season_id: string;
  state: PvpSeasonOperationState;
  queue_open: 0 | 1;
  next_season_id: string | null;
  started_at: number | null;
  finalized_at: number | null;
  revision: number;
};

type ActivityRow = {
  live_matches: number;
  live_queue: number;
};

type ClosureRow = {
  season_id: string;
  next_season_id: string;
  closed_at: number;
  rolled_at: number | null;
  player_count: number;
  placement_player_count: number;
};

function seconds(ms: number): number {
  return Math.floor(ms / 1000);
}

function nonEmptyId(value: string, context: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 128) throw new Error(`${context} must be 1..128 characters`);
  return normalized;
}

function closureView(row: ClosureRow): PvpSeasonClosure {
  return {
    seasonId: row.season_id,
    nextSeasonId: row.next_season_id,
    closedAtMs: row.closed_at * 1000,
    rolledAtMs: row.rolled_at === null ? null : row.rolled_at * 1000,
    playerCount: row.player_count,
    placementPlayerCount: row.placement_player_count,
  };
}

async function ensureOperationRow(db: D1Database, nowMs: number): Promise<OperationRow> {
  await db.prepare(
    `INSERT INTO pvp_season_operations
      (singleton_id, season_id, state, queue_open, next_season_id, started_at, finalized_at, revision, updated_at)
     VALUES (1, ?1, 'OPEN', 1, NULL, NULL, NULL, 0, ?2)
     ON CONFLICT(singleton_id) DO NOTHING`,
  ).bind(PVP_CURRENT_SEASON_ID, seconds(nowMs)).run();
  const row = await db.prepare(
    `SELECT season_id, state, queue_open, next_season_id, started_at, finalized_at, revision
     FROM pvp_season_operations WHERE singleton_id = 1`,
  ).first<OperationRow>();
  if (!row) throw new Error('pvp_season_operations_row_missing');
  if (row.state === 'OPEN' && row.season_id !== PVP_CURRENT_SEASON_ID) {
    throw new Error('pvp_season_operations_code_mismatch');
  }
  return row;
}

async function loadClosure(db: D1Database, seasonId: string): Promise<PvpSeasonClosure | null> {
  const row = await db.prepare(
    `SELECT season_id, next_season_id, closed_at, rolled_at, player_count, placement_player_count
     FROM pvp_season_closures WHERE season_id = ?1`,
  ).bind(seasonId).first<ClosureRow>();
  return row ? closureView(row) : null;
}

async function loadActivity(db: D1Database, seasonId: string, nowMs: number): Promise<ActivityRow> {
  const row = await db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM pvp_matches
        WHERE season_id = ?1 AND state IN ('CREATED','ACTIVE')) AS live_matches,
       (SELECT COUNT(*) FROM pvp_matchmaking_queue
        WHERE season_id = ?1 AND state IN ('QUEUED','PAIRING') AND expires_at > ?2) AS live_queue`,
  ).bind(seasonId, seconds(nowMs)).first<ActivityRow>();
  return { live_matches: row?.live_matches ?? 0, live_queue: row?.live_queue ?? 0 };
}

async function snapshotFromRow(db: D1Database, row: OperationRow, nowMs: number): Promise<PvpSeasonOperationsSnapshot> {
  const [activity, closure] = await Promise.all([
    loadActivity(db, row.season_id, nowMs),
    loadClosure(db, row.season_id),
  ]);
  const nextSeasonId = row.next_season_id;
  const closed = closure !== null;
  return {
    codeSeasonId: PVP_CURRENT_SEASON_ID,
    seasonId: row.season_id,
    state: row.state,
    queueOpen: row.queue_open === 1,
    nextSeasonId,
    startedAtMs: row.started_at === null ? null : row.started_at * 1000,
    finalizedAtMs: row.finalized_at === null ? null : row.finalized_at * 1000,
    revision: row.revision,
    liveMatches: activity.live_matches,
    liveQueueEntries: activity.live_queue,
    closure,
    readyToFinalize: row.state === 'DRAINING' && activity.live_matches === 0 && activity.live_queue === 0,
    deployNextSeasonRequired: row.state === 'CLOSED_PENDING_DEPLOY' && nextSeasonId !== null && PVP_CURRENT_SEASON_ID !== nextSeasonId,
    readyToRoll: row.state === 'CLOSED_PENDING_DEPLOY' && closed && nextSeasonId !== null && PVP_CURRENT_SEASON_ID === nextSeasonId,
  };
}

export async function getPvpSeasonOperationsSnapshot(
  db: D1Database,
  nowMs = Date.now(),
): Promise<PvpSeasonOperationsSnapshot> {
  return snapshotFromRow(db, await ensureOperationRow(db, nowMs), nowMs);
}

export async function assertPvpPublicQueueAdmission(
  db: D1Database,
  nowMs = Date.now(),
): Promise<void> {
  const row = await ensureOperationRow(db, nowMs);
  if (row.state !== 'OPEN' || row.queue_open !== 1) throw new Error('pvp_public_queue_closed_for_season_settlement');
  if (row.season_id !== PVP_CURRENT_SEASON_ID) throw new Error('pvp_public_queue_season_mismatch');
}

export async function beginPvpSeasonSettlement(
  db: D1Database,
  rawNextSeasonId: string,
  nowMs = Date.now(),
): Promise<PvpSeasonOperationsSnapshot> {
  const nextSeasonId = nonEmptyId(rawNextSeasonId, 'nextSeasonId');
  let row = await ensureOperationRow(db, nowMs);
  if (nextSeasonId === row.season_id) throw new Error('pvp_season_next_id_must_differ');
  if (row.state !== 'OPEN') {
    if (row.next_season_id === nextSeasonId) return snapshotFromRow(db, row, nowMs);
    throw new Error('pvp_season_settlement_already_in_progress');
  }
  if (row.season_id !== PVP_CURRENT_SEASON_ID) throw new Error('pvp_season_operations_code_mismatch');
  const now = seconds(nowMs);
  const writes = await db.batch([
    db.prepare(
      `UPDATE pvp_season_operations
       SET state = 'DRAINING', queue_open = 0, next_season_id = ?1,
           started_at = ?2, finalized_at = NULL, revision = revision + 1, updated_at = ?2
       WHERE singleton_id = 1 AND revision = ?3 AND state = 'OPEN'`,
    ).bind(nextSeasonId, now, row.revision),
    db.prepare(
      `DELETE FROM pvp_matchmaking_queue
       WHERE season_id = ?1 AND state = 'QUEUED'`,
    ).bind(row.season_id),
  ]);
  if ((writes[0]?.meta.changes ?? 0) !== 1) {
    row = await ensureOperationRow(db, nowMs);
    if (row.state !== 'OPEN' && row.next_season_id === nextSeasonId) return snapshotFromRow(db, row, nowMs);
    throw new Error('pvp_season_settlement_begin_conflict');
  }
  row = await ensureOperationRow(db, nowMs);
  return snapshotFromRow(db, row, nowMs);
}

export async function reopenPvpSeasonBeforeFinalization(
  db: D1Database,
  nowMs = Date.now(),
): Promise<PvpSeasonOperationsSnapshot> {
  let row = await ensureOperationRow(db, nowMs);
  if (row.state === 'OPEN') return snapshotFromRow(db, row, nowMs);
  if (row.state !== 'DRAINING') throw new Error('pvp_season_already_finalized');
  if (await loadClosure(db, row.season_id)) throw new Error('pvp_season_already_finalized');
  if (row.season_id !== PVP_CURRENT_SEASON_ID) throw new Error('pvp_season_operations_code_mismatch');
  const now = seconds(nowMs);
  const write = await db.prepare(
    `UPDATE pvp_season_operations
     SET state = 'OPEN', queue_open = 1, next_season_id = NULL,
         started_at = NULL, finalized_at = NULL, revision = revision + 1, updated_at = ?1
     WHERE singleton_id = 1 AND revision = ?2 AND state = 'DRAINING'`,
  ).bind(now, row.revision).run();
  if ((write.meta.changes ?? 0) !== 1) throw new Error('pvp_season_reopen_conflict');
  row = await ensureOperationRow(db, nowMs);
  return snapshotFromRow(db, row, nowMs);
}

export async function finalizeCurrentPvpSeasonSettlement(
  db: D1Database,
  nowMs = Date.now(),
): Promise<PvpSeasonOperationsSnapshot> {
  let row = await ensureOperationRow(db, nowMs);
  if (row.state === 'CLOSED_PENDING_DEPLOY') return snapshotFromRow(db, row, nowMs);
  if (row.state !== 'DRAINING' || !row.next_season_id) throw new Error('pvp_season_settlement_not_started');
  if (row.season_id !== PVP_CURRENT_SEASON_ID) throw new Error('pvp_season_operations_code_mismatch');
  await db.prepare(
    `DELETE FROM pvp_matchmaking_queue
     WHERE season_id = ?1 AND state = 'QUEUED'`,
  ).bind(row.season_id).run();
  const closure = await finalizePvpSeason(db, row.season_id, row.next_season_id, nowMs);
  const finalizedAt = seconds(closure.closedAtMs);
  const write = await db.prepare(
    `UPDATE pvp_season_operations
     SET state = 'CLOSED_PENDING_DEPLOY', queue_open = 0,
         finalized_at = ?1, revision = revision + 1, updated_at = ?1
     WHERE singleton_id = 1 AND revision = ?2 AND state = 'DRAINING'`,
  ).bind(finalizedAt, row.revision).run();
  if ((write.meta.changes ?? 0) !== 1) {
    row = await ensureOperationRow(db, nowMs);
    if (row.state !== 'CLOSED_PENDING_DEPLOY') throw new Error('pvp_season_finalize_latch_conflict');
    return snapshotFromRow(db, row, nowMs);
  }
  row = await ensureOperationRow(db, nowMs);
  return snapshotFromRow(db, row, nowMs);
}

export async function rollFinalizedPvpSeasonAfterDeploy(
  db: D1Database,
  nowMs = Date.now(),
): Promise<PvpSeasonOperationsSnapshot> {
  let row = await ensureOperationRow(db, nowMs);
  if (row.state === 'OPEN') return snapshotFromRow(db, row, nowMs);
  if (row.state !== 'CLOSED_PENDING_DEPLOY' || !row.next_season_id) throw new Error('pvp_season_not_ready_to_roll');
  if (PVP_CURRENT_SEASON_ID !== row.next_season_id) throw new Error('pvp_season_next_code_deploy_required');
  const closure = await loadClosure(db, row.season_id);
  if (!closure || closure.nextSeasonId !== row.next_season_id) throw new Error('pvp_season_closure_missing_or_mismatched');
  await rollClosedPvpSeasonToCurrent(db, row.season_id, nowMs);
  const now = seconds(nowMs);
  const previousRevision = row.revision;
  const write = await db.prepare(
    `UPDATE pvp_season_operations
     SET season_id = ?1, state = 'OPEN', queue_open = 1, next_season_id = NULL,
         started_at = NULL, finalized_at = NULL, revision = revision + 1, updated_at = ?2
     WHERE singleton_id = 1 AND revision = ?3 AND state = 'CLOSED_PENDING_DEPLOY'`,
  ).bind(PVP_CURRENT_SEASON_ID, now, previousRevision).run();
  if ((write.meta.changes ?? 0) !== 1) {
    row = await ensureOperationRow(db, nowMs);
    if (row.state !== 'OPEN' || row.season_id !== PVP_CURRENT_SEASON_ID) throw new Error('pvp_season_roll_latch_conflict');
    return snapshotFromRow(db, row, nowMs);
  }
  row = await ensureOperationRow(db, nowMs);
  return snapshotFromRow(db, row, nowMs);
}

export const __pvpSeasonOperationsTestOnly = {
  nonEmptyId,
};
