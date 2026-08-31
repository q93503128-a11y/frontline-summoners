export const PUBLIC_COOP_QUEUE_TTL_MS = 3 * 60 * 1000;
export const PUBLIC_COOP_MATCH_RETENTION_MS = 6 * 60 * 60 * 1000;

export type PublicCoopQueueState = 'QUEUED' | 'PAIRING' | 'MATCHED';

export interface PublicCoopQueueRow {
  readonly user_id: string;
  readonly stage_id: string;
  readonly state: PublicCoopQueueState;
  readonly queued_at: number;
  readonly expires_at: number;
  readonly match_id: string | null;
  readonly seat_id: 'A' | 'B' | null;
  readonly paired_at: number | null;
}

export interface PublicCoopPair {
  readonly matchId: string;
  readonly stageId: string;
  readonly accountA: string;
  readonly accountB: string;
}

function nonEmptyId(value: string, context: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 128) throw new Error(`${context} must be 1..128 characters`);
  return normalized;
}

function seconds(ms: number): number {
  return Math.floor(ms / 1000);
}

export async function loadPublicCoopQueueRow(db: D1Database, rawUserId: string): Promise<PublicCoopQueueRow | null> {
  const userId = nonEmptyId(rawUserId, 'userId');
  return db.prepare(
    `SELECT user_id, stage_id, state, queued_at, expires_at, match_id, seat_id, paired_at
     FROM coop_matchmaking_queue
     WHERE user_id = ?1`,
  ).bind(userId).first<PublicCoopQueueRow>();
}

export async function enterPublicCoopQueue(
  db: D1Database,
  rawUserId: string,
  rawStageId: string,
  nowMs = Date.now(),
): Promise<PublicCoopQueueRow> {
  const userId = nonEmptyId(rawUserId, 'userId');
  const stageId = nonEmptyId(rawStageId, 'stageId');
  const now = seconds(nowMs);
  const expires = seconds(nowMs + PUBLIC_COOP_QUEUE_TTL_MS);
  const existing = await loadPublicCoopQueueRow(db, userId);

  if (existing?.state === 'MATCHED' || existing?.state === 'PAIRING') return existing;
  if (existing?.state === 'QUEUED' && existing.stage_id === stageId && existing.expires_at > now) {
    await db.prepare(
      `UPDATE coop_matchmaking_queue SET expires_at = ?1
       WHERE user_id = ?2 AND state = 'QUEUED' AND stage_id = ?3`,
    ).bind(expires, userId, stageId).run();
  } else {
    await db.prepare(
      `INSERT INTO coop_matchmaking_queue
       (user_id, stage_id, state, queued_at, expires_at, match_id, seat_id, paired_at)
       VALUES (?1, ?2, 'QUEUED', ?3, ?4, NULL, NULL, NULL)
       ON CONFLICT(user_id) DO UPDATE SET
         stage_id = excluded.stage_id,
         state = 'QUEUED',
         queued_at = excluded.queued_at,
         expires_at = excluded.expires_at,
         match_id = NULL,
         seat_id = NULL,
         paired_at = NULL
       WHERE coop_matchmaking_queue.state = 'QUEUED'`,
    ).bind(userId, stageId, now, expires).run();
  }

  const row = await loadPublicCoopQueueRow(db, userId);
  if (!row) throw new Error('public_coop_queue_write_failed');
  return row;
}

export async function expirePublicCoopQueueRow(db: D1Database, rawUserId: string, nowMs = Date.now()): Promise<void> {
  const userId = nonEmptyId(rawUserId, 'userId');
  await db.prepare(
    `DELETE FROM coop_matchmaking_queue
     WHERE user_id = ?1 AND state = 'QUEUED' AND expires_at <= ?2`,
  ).bind(userId, seconds(nowMs)).run();
}

export async function findPublicCoopCandidate(
  db: D1Database,
  rawUserId: string,
  rawStageId: string,
  nowMs = Date.now(),
): Promise<string | null> {
  const userId = nonEmptyId(rawUserId, 'userId');
  const stageId = nonEmptyId(rawStageId, 'stageId');
  const row = await db.prepare(
    `SELECT q.user_id
     FROM coop_matchmaking_queue q
     WHERE q.stage_id = ?1
       AND q.user_id <> ?2
       AND q.state = 'QUEUED'
       AND q.expires_at > ?3
       AND NOT EXISTS (
         SELECT 1 FROM social_blocks b
         WHERE (b.blocker_id = ?2 AND b.blocked_id = q.user_id)
            OR (b.blocker_id = q.user_id AND b.blocked_id = ?2)
       )
     ORDER BY q.queued_at ASC, q.user_id ASC
     LIMIT 1`,
  ).bind(stageId, userId, seconds(nowMs)).first<{ user_id: string }>();
  return row?.user_id ?? null;
}

export async function discardQueuedPublicCoopCandidate(db: D1Database, rawUserId: string): Promise<void> {
  const userId = nonEmptyId(rawUserId, 'userId');
  await db.prepare(`DELETE FROM coop_matchmaking_queue WHERE user_id = ?1 AND state = 'QUEUED'`).bind(userId).run();
}

export async function pairPublicCoopQueueRows(
  db: D1Database,
  rawAccountA: string,
  rawAccountB: string,
  rawStageId: string,
  rawMatchId: string,
  nowMs = Date.now(),
): Promise<PublicCoopPair | null> {
  const accountA = nonEmptyId(rawAccountA, 'accountA');
  const accountB = nonEmptyId(rawAccountB, 'accountB');
  const stageId = nonEmptyId(rawStageId, 'stageId');
  const matchId = nonEmptyId(rawMatchId, 'matchId');
  if (accountA === accountB) throw new Error('public_coop_self_pair');
  const now = seconds(nowMs);

  const writes = await db.batch([
    db.prepare(
      `UPDATE coop_matchmaking_queue
       SET state = 'PAIRING', match_id = ?1, seat_id = 'A', paired_at = ?2
       WHERE user_id = ?3 AND stage_id = ?4 AND state = 'QUEUED' AND expires_at > ?2`,
    ).bind(matchId, now, accountA, stageId),
    db.prepare(
      `UPDATE coop_matchmaking_queue
       SET state = 'PAIRING', match_id = ?1, seat_id = 'B', paired_at = ?2
       WHERE user_id = ?3 AND stage_id = ?4 AND state = 'QUEUED' AND expires_at > ?2`,
    ).bind(matchId, now, accountB, stageId),
  ]);
  const claimedA = writes[0]?.meta.changes ?? 0;
  const claimedB = writes[1]?.meta.changes ?? 0;
  if (claimedA === 1 && claimedB === 1) return { matchId, stageId, accountA, accountB };

  await db.prepare(
    `UPDATE coop_matchmaking_queue
     SET state = 'QUEUED', match_id = NULL, seat_id = NULL, paired_at = NULL
     WHERE match_id = ?1 AND state = 'PAIRING'`,
  ).bind(matchId).run();
  return null;
}

export async function finalizePublicCoopPair(db: D1Database, rawMatchId: string, nowMs = Date.now()): Promise<void> {
  const matchId = nonEmptyId(rawMatchId, 'matchId');
  const expires = seconds(nowMs + PUBLIC_COOP_MATCH_RETENTION_MS);
  const write = await db.prepare(
    `UPDATE coop_matchmaking_queue
     SET state = 'MATCHED', expires_at = ?1
     WHERE match_id = ?2 AND state = 'PAIRING'`,
  ).bind(expires, matchId).run();
  if ((write.meta.changes ?? 0) !== 2) throw new Error('public_coop_pair_finalize_failed');
}

export async function rollbackPublicCoopPair(db: D1Database, rawMatchId: string, nowMs = Date.now()): Promise<void> {
  const matchId = nonEmptyId(rawMatchId, 'matchId');
  const expires = seconds(nowMs + PUBLIC_COOP_QUEUE_TTL_MS);
  await db.prepare(
    `UPDATE coop_matchmaking_queue
     SET state = 'QUEUED', expires_at = ?1, match_id = NULL, seat_id = NULL, paired_at = NULL
     WHERE match_id = ?2 AND state IN ('PAIRING','MATCHED')`,
  ).bind(expires, matchId).run();
}

export async function leavePublicCoopQueue(db: D1Database, rawUserId: string): Promise<'IDLE' | 'LEFT' | 'ALREADY_MATCHED'> {
  const userId = nonEmptyId(rawUserId, 'userId');
  const row = await loadPublicCoopQueueRow(db, userId);
  if (!row) return 'IDLE';
  if (row.state !== 'QUEUED') return 'ALREADY_MATCHED';
  await db.prepare(`DELETE FROM coop_matchmaking_queue WHERE user_id = ?1 AND state = 'QUEUED'`).bind(userId).run();
  return 'LEFT';
}

export async function clearExpiredPublicCoopMatchRow(db: D1Database, rawUserId: string, nowMs = Date.now()): Promise<void> {
  const userId = nonEmptyId(rawUserId, 'userId');
  await db.prepare(`DELETE FROM coop_matchmaking_queue WHERE user_id = ?1 AND expires_at <= ?2`).bind(userId, seconds(nowMs)).run();
}
