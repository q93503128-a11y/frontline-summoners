import type { PvpModeId } from '@frontline/sim/pvp-content';
import { resolveAuthSession } from './auth-session-authority.ts';
import { getAccountPvpEligibility, getAccountPvpSeatAuthority } from './account-pvp-authority.ts';
import {
  clearExpiredPvpQueueRow,
  enterPublicPvpQueue,
  getPvpLeaderboard,
  getPvpRatingView,
  leavePublicPvpQueue,
  loadPvpQueueRow,
  tryCreatePublicPvpMatch,
  type PvpQueueRow,
  type PublicPvpModeId,
  type PublicPvpMatchAssignment,
} from './pvp-authority.ts';
import { voidTrustedPvpMatch } from './pvp-result-authority.ts';
import type { PvpRoom } from './pvp-durable-room.ts';

export interface PvpHttpEnv {
  readonly DB: D1Database;
  readonly PVP_ROOM: DurableObjectNamespace<PvpRoom>;
}

export interface PvpHttpResult {
  readonly status: number;
  readonly body: unknown;
}

const LIVE_PUBLIC_1V1_MODES = new Set<PvpModeId>(['pvp_casual_1v1', 'pvp_ranked_1v1']);
const PVP_SOCKET_PATTERN = /^\/api\/pvp\/matches\/([A-Za-z0-9_-]{1,128})\/websocket$/;

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

function pvpModeId(value: unknown): PvpModeId | null {
  return value === 'pvp_casual_1v1' || value === 'pvp_ranked_1v1' || value === 'pvp_casual_2v2'
    || value === 'pvp_friendly_1v1' || value === 'pvp_friendly_2v2'
    ? value
    : null;
}

function queueBody(row: PvpQueueRow): Readonly<Record<string, unknown>> {
  return {
    state: row.state,
    modeId: row.mode_id,
    queuedAtMs: row.queued_at * 1000,
    expiresAtMs: row.expires_at * 1000,
  };
}

async function initializeLiveMatch(env: PvpHttpEnv, assignment: PublicPvpMatchAssignment): Promise<boolean> {
  if (assignment.modeId !== 'pvp_casual_1v1' && assignment.modeId !== 'pvp_ranked_1v1') return false;
  const accountA = assignment.assignments.find((entry) => entry.teamId === 'A' && entry.seatIndex === 0)?.userId;
  const accountB = assignment.assignments.find((entry) => entry.teamId === 'B' && entry.seatIndex === 0)?.userId;
  if (!accountA || !accountB || assignment.assignments.length !== 2) return false;
  const tokenA = crypto.randomUUID();
  const tokenB = crypto.randomUUID();
  const stub = env.PVP_ROOM.get(env.PVP_ROOM.idFromName(assignment.matchId));
  const response = await stub.fetch(new Request('https://pvp-room.internal/initialize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      matchId: assignment.matchId,
      joinTokens: { A: tokenA, B: tokenB },
    }),
  }));
  if (response.ok) return true;
  await voidTrustedPvpMatch(env.DB, assignment.matchId).catch(() => undefined);
  return false;
}

async function matchedBody(env: PvpHttpEnv, accountId: string, row: PvpQueueRow): Promise<PvpHttpResult> {
  if (row.state !== 'MATCHED' || !row.match_id || !row.team_id) return { status: 200, body: queueBody(row) };
  if (row.seat_index !== 0) return { status: 409, body: { error: 'pvp_live_1v1_seat_invalid' } };
  const stub = env.PVP_ROOM.get(env.PVP_ROOM.idFromName(row.match_id));
  const response = await stub.fetch(new Request('https://pvp-room.internal/seat-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ seatId: row.team_id, accountId }),
  }));
  if (!response.ok) {
    if (response.status === 404) {
      await voidTrustedPvpMatch(env.DB, row.match_id).catch(() => undefined);
      return { status: 409, body: { error: 'pvp_match_room_lost_requeue_required' } };
    }
    return { status: 503, body: { error: 'pvp_match_room_unavailable' } };
  }
  const payload = await response.json() as { token?: unknown };
  if (typeof payload.token !== 'string') return { status: 503, body: { error: 'pvp_match_seat_token_missing' } };
  return {
    status: 200,
    body: {
      state: 'MATCHED',
      modeId: row.mode_id,
      matchId: row.match_id,
      seatId: row.team_id,
      websocketPath: `/api/pvp/matches/${encodeURIComponent(row.match_id)}/websocket?token=${encodeURIComponent(payload.token)}`,
      matchedAtMs: (row.paired_at ?? row.queued_at) * 1000,
    },
  };
}

async function joinLive1v1(
  env: PvpHttpEnv,
  accountId: string,
  modeId: PublicPvpModeId,
  nowMs: number,
): Promise<PvpHttpResult> {
  if (!LIVE_PUBLIC_1V1_MODES.has(modeId)) return { status: 409, body: { error: 'pvp_2v2_runtime_not_open_yet' } };
  await getAccountPvpSeatAuthority(env.DB, accountId, modeId, nowMs);
  let own = await enterPublicPvpQueue(env.DB, accountId, modeId, nowMs);
  if (own.state === 'MATCHED') return matchedBody(env, accountId, own);
  if (own.state === 'PAIRING') return { status: 200, body: queueBody(own) };
  const assignment = await tryCreatePublicPvpMatch(env.DB, accountId, nowMs);
  if (assignment) {
    if (!await initializeLiveMatch(env, assignment)) return { status: 503, body: { error: 'pvp_match_initialization_failed' } };
    own = await loadPvpQueueRow(env.DB, accountId) ?? own;
    return matchedBody(env, accountId, own);
  }
  own = await loadPvpQueueRow(env.DB, accountId) ?? own;
  return { status: 200, body: queueBody(own) };
}

/** WebSocket routing intentionally uses the opaque seat token, not a bearer session. */
export async function resolvePvpWebSocket(request: Request, env: PvpHttpEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(PVP_SOCKET_PATTERN);
  if (request.method !== 'GET' || !match) return null;
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return new Response(JSON.stringify({ error: 'websocket_upgrade_required' }), {
      status: 426,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  const matchId = match[1]!;
  return env.PVP_ROOM.get(env.PVP_ROOM.idFromName(matchId)).fetch(request);
}

export async function resolvePvpHttp(
  request: Request,
  env: PvpHttpEnv,
  nowMs = Date.now(),
): Promise<PvpHttpResult | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/pvp')) return null;
  if (PVP_SOCKET_PATTERN.test(url.pathname)) return null;
  const principal = await resolveAuthSession(env.DB, request.headers.get('authorization'), nowMs);
  if (!principal) return { status: 401, body: { error: 'authentication_required' } };

  try {
    if (request.method === 'GET' && url.pathname === '/api/pvp/me') {
      const [rating, eligibility] = await Promise.all([
        getPvpRatingView(env.DB, principal.userId, nowMs),
        getAccountPvpEligibility(env.DB, principal.userId, nowMs),
      ]);
      return { status: 200, body: { rating, eligibility } };
    }

    if (request.method === 'GET' && url.pathname === '/api/pvp/leaderboard') {
      const requested = Number(url.searchParams.get('limit') ?? '100');
      const limit = Number.isFinite(requested) ? requested : 100;
      return { status: 200, body: { seasonId: 'preseason_v1', entries: await getPvpLeaderboard(env.DB, limit) } };
    }

    if (request.method === 'POST' && url.pathname === '/api/pvp/matchmaking/join') {
      const body = await readJson(request);
      const modeId = pvpModeId(body.modeId);
      if (!modeId) return { status: 400, body: { error: 'pvp_mode_required' } };
      if (modeId !== 'pvp_casual_1v1' && modeId !== 'pvp_ranked_1v1' && modeId !== 'pvp_casual_2v2') {
        return { status: 400, body: { error: 'pvp_mode_not_public_matchmaking' } };
      }
      return joinLive1v1(env, principal.userId, modeId, nowMs);
    }

    if (request.method === 'GET' && url.pathname === '/api/pvp/matchmaking/status') {
      await clearExpiredPvpQueueRow(env.DB, principal.userId, nowMs);
      const row = await loadPvpQueueRow(env.DB, principal.userId);
      if (!row) return { status: 200, body: { state: 'IDLE' } };
      if (row.state === 'MATCHED') return matchedBody(env, principal.userId, row);
      return { status: 200, body: queueBody(row) };
    }

    if (request.method === 'POST' && url.pathname === '/api/pvp/matchmaking/leave') {
      const left = await leavePublicPvpQueue(env.DB, principal.userId);
      if (left === 'ALREADY_MATCHED') return { status: 409, body: { error: 'pvp_already_matched' } };
      return { status: 200, body: { state: 'IDLE', left: left === 'LEFT' } };
    }

    return { status: 404, body: { error: 'not_found' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'pvp_request_failed';
    const forbidden = message.includes('required') || message.includes('ineligible') || message.includes('locked');
    return { status: forbidden ? 403 : 400, body: { error: message } };
  }
}

export const __pvpHttpTestOnly = { queueBody, pvpModeId };
