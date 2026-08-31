import { resolveAuthSession } from './auth-session-authority.ts';
import { getAccountCoopSeatAuthority } from './account-coop-authority.ts';
import {
  clearExpiredPublicCoopMatchRow,
  discardQueuedPublicCoopCandidate,
  enterPublicCoopQueue,
  expirePublicCoopQueueRow,
  finalizePublicCoopPair,
  findPublicCoopCandidate,
  leavePublicCoopQueue,
  loadPublicCoopQueueRow,
  pairPublicCoopQueueRows,
  rollbackPublicCoopPair,
  type PublicCoopQueueRow,
} from './coop-matchmaking-authority.ts';

export interface CoopMatchmakingHttpEnv {
  readonly DB: D1Database;
  readonly BATTLE_ROOM: DurableObjectNamespace;
}

export interface CoopMatchmakingHttpResult {
  readonly status: number;
  readonly body: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function queueBody(row: PublicCoopQueueRow): Readonly<Record<string, unknown>> {
  return {
    state: row.state,
    stageId: row.stage_id,
    queuedAtMs: row.queued_at * 1000,
    expiresAtMs: row.expires_at * 1000,
  };
}

async function matchedBody(
  env: CoopMatchmakingHttpEnv,
  accountId: string,
  row: PublicCoopQueueRow,
): Promise<CoopMatchmakingHttpResult> {
  if (row.state !== 'MATCHED' || !row.match_id || !row.seat_id) return { status: 200, body: queueBody(row) };
  const stub = env.BATTLE_ROOM.get(env.BATTLE_ROOM.idFromName(row.match_id));
  const response = await stub.fetch(new Request('https://battle-room.internal/seat-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ seatId: row.seat_id, accountId }),
  }));
  if (!response.ok) {
    if (response.status === 404) {
      await rollbackPublicCoopPair(env.DB, row.match_id);
      const reset = await loadPublicCoopQueueRow(env.DB, accountId);
      return reset ? { status: 200, body: queueBody(reset) } : { status: 200, body: { state: 'IDLE' } };
    }
    return { status: 503, body: { error: 'public_coop_room_unavailable' } };
  }
  const payload = await response.json() as { token?: unknown };
  if (typeof payload.token !== 'string') return { status: 503, body: { error: 'public_coop_seat_token_missing' } };
  return {
    status: 200,
    body: {
      state: 'MATCHED',
      stageId: row.stage_id,
      matchId: row.match_id,
      seatId: row.seat_id,
      websocketPath: `/api/matches/${encodeURIComponent(row.match_id)}/websocket?token=${encodeURIComponent(payload.token)}`,
      matchedAtMs: (row.paired_at ?? row.queued_at) * 1000,
    },
  };
}

async function initializePublicRoom(
  env: CoopMatchmakingHttpEnv,
  pair: { readonly matchId: string; readonly stageId: string; readonly accountA: string; readonly accountB: string },
  nowMs: number,
): Promise<boolean> {
  const hostToken = crypto.randomUUID();
  const guestToken = crypto.randomUUID();
  const stub = env.BATTLE_ROOM.get(env.BATTLE_ROOM.idFromName(pair.matchId));
  const initialized = await stub.fetch(new Request('https://battle-room.internal/initialize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      matchId: pair.matchId,
      stageId: pair.stageId,
      joinTokens: { A: hostToken, B: guestToken },
      seatAccountIds: { A: pair.accountA, B: pair.accountB },
    }),
  }));
  if (!initialized.ok) {
    await rollbackPublicCoopPair(env.DB, pair.matchId, nowMs);
    return false;
  }
  try {
    await finalizePublicCoopPair(env.DB, pair.matchId, nowMs);
    return true;
  } catch (error) {
    await stub.fetch(new Request('https://battle-room.internal/cancel', { method: 'POST' })).catch(() => undefined);
    await rollbackPublicCoopPair(env.DB, pair.matchId, nowMs);
    throw error;
  }
}

async function joinQueue(
  env: CoopMatchmakingHttpEnv,
  accountId: string,
  stageId: string,
  nowMs: number,
): Promise<CoopMatchmakingHttpResult> {
  await getAccountCoopSeatAuthority(env.DB, accountId, stageId, nowMs);
  await expirePublicCoopQueueRow(env.DB, accountId, nowMs);
  let own = await enterPublicCoopQueue(env.DB, accountId, stageId, nowMs);
  if (own.state === 'MATCHED') return matchedBody(env, accountId, own);
  if (own.state === 'PAIRING') return { status: 200, body: queueBody(own) };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidateId = await findPublicCoopCandidate(env.DB, accountId, stageId, nowMs);
    if (!candidateId) break;
    try {
      await getAccountCoopSeatAuthority(env.DB, candidateId, stageId, nowMs);
    } catch {
      await discardQueuedPublicCoopCandidate(env.DB, candidateId);
      continue;
    }
    const matchId = crypto.randomUUID();
    const pair = await pairPublicCoopQueueRows(env.DB, candidateId, accountId, stageId, matchId, nowMs);
    if (!pair) continue;
    if (!await initializePublicRoom(env, pair, nowMs)) continue;
    own = await loadPublicCoopQueueRow(env.DB, accountId) ?? own;
    return matchedBody(env, accountId, own);
  }

  own = await loadPublicCoopQueueRow(env.DB, accountId) ?? own;
  return { status: 200, body: queueBody(own) };
}

export async function resolveCoopMatchmakingHttp(
  request: Request,
  env: CoopMatchmakingHttpEnv,
  nowMs = Date.now(),
): Promise<CoopMatchmakingHttpResult | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/coop/matchmaking')) return null;
  const principal = await resolveAuthSession(env.DB, request.headers.get('authorization'), nowMs);
  if (!principal) return { status: 401, body: { error: 'authentication_required' } };

  try {
    if (request.method === 'POST' && url.pathname === '/api/coop/matchmaking/join') {
      const body = await readJson(request);
      const stageId = text(body.stageId);
      if (!stageId) return { status: 400, body: { error: 'stage_id_required' } };
      return joinQueue(env, principal.userId, stageId, nowMs);
    }

    if (request.method === 'GET' && url.pathname === '/api/coop/matchmaking/status') {
      await clearExpiredPublicCoopMatchRow(env.DB, principal.userId, nowMs);
      const row = await loadPublicCoopQueueRow(env.DB, principal.userId);
      if (!row) return { status: 200, body: { state: 'IDLE' } };
      if (row.state === 'MATCHED') return matchedBody(env, principal.userId, row);
      return { status: 200, body: queueBody(row) };
    }

    if (request.method === 'POST' && url.pathname === '/api/coop/matchmaking/leave') {
      const result = await leavePublicCoopQueue(env.DB, principal.userId);
      if (result === 'ALREADY_MATCHED') return { status: 409, body: { error: 'public_coop_already_matched' } };
      return { status: 200, body: { state: 'IDLE', left: result === 'LEFT' } };
    }

    return { status: 404, body: { error: 'not_found' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'public_coop_matchmaking_failed';
    const status = message.includes('locked') || message.includes('not currently available') || message.includes('not_coop_eligible') ? 403 : 400;
    return { status, body: { error: message } };
  }
}

export const __coopMatchmakingHttpTestOnly = { queueBody };
