import type { Pvp2v2Room } from './pvp-2v2-durable-room.ts';
import type { Pvp2v2SeatId } from '@frontline/sim/pvp-2v2-playable';
import { getAccountPvpSeatAuthority } from './account-pvp-authority.ts';
import { resolveAuthSession } from './auth-session-authority.ts';
import {
  clearExpiredPvpQueueRow,
  enterPublicPvpQueue,
  leavePublicPvpQueue,
  loadPvpQueueRow,
  tryCreatePublicPvpMatch,
  type PublicPvpMatchAssignment,
} from './pvp-authority.ts';
import { voidTrustedPvpMatch } from './pvp-result-authority.ts';

export interface Pvp2v2HttpEnv {
  readonly DB: D1Database;
  readonly PVP_2V2_ROOM: DurableObjectNamespace<Pvp2v2Room>;
}

export interface Pvp2v2HttpResult { readonly status: number; readonly body: unknown; }

const SOCKET_PATTERN = /^\/api\/pvp\/2v2\/matches\/([A-Za-z0-9_-]{1,128})\/websocket$/;

function seatId(teamId: 'A' | 'B', seatIndex: 0 | 1): Pvp2v2SeatId { return `${teamId}${seatIndex + 1}` as Pvp2v2SeatId; }
function stub(env: Pvp2v2HttpEnv, matchId: string) { return env.PVP_2V2_ROOM.get(env.PVP_2V2_ROOM.idFromName(matchId)); }

async function initializeMatch(env: Pvp2v2HttpEnv, match: PublicPvpMatchAssignment): Promise<boolean> {
  if (match.modeId !== 'pvp_casual_2v2' || match.assignments.length !== 4) return false;
  const joinTokens = Object.fromEntries(match.assignments.map((assignment) => [seatId(assignment.teamId, assignment.seatIndex), crypto.randomUUID()]));
  const response = await stub(env, match.matchId).fetch(new Request('https://pvp-2v2.internal/initialize', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ matchId: match.matchId, joinTokens }),
  }));
  if (response.ok) return true;
  await voidTrustedPvpMatch(env.DB, match.matchId).catch(() => undefined);
  return false;
}

async function matchedState(env: Pvp2v2HttpEnv, userId: string, matchId: string, teamId: 'A' | 'B', seatIndex: 0 | 1, pairedAt: number): Promise<Pvp2v2HttpResult> {
  const seat = seatId(teamId, seatIndex);
  const response = await stub(env, matchId).fetch(new Request('https://pvp-2v2.internal/seat-token', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accountId: userId, seatId: seat }),
  }));
  if (!response.ok) {
    await voidTrustedPvpMatch(env.DB, matchId).catch(() => undefined);
    return { status: 409, body: { error: 'pvp_2v2_match_room_lost_requeue_required' } };
  }
  const payload = await response.json() as { token?: unknown };
  if (typeof payload.token !== 'string') return { status: 503, body: { error: 'pvp_2v2_seat_token_missing' } };
  return {
    status: 200,
    body: {
      state: 'MATCHED', modeId: 'pvp_casual_2v2', matchId, seatId: seat,
      matchedAtMs: pairedAt * 1000,
      websocketPath: `/api/pvp/2v2/matches/${encodeURIComponent(matchId)}/websocket?token=${encodeURIComponent(payload.token)}`,
    },
  };
}

async function status(env: Pvp2v2HttpEnv, userId: string, nowMs: number): Promise<Pvp2v2HttpResult> {
  await clearExpiredPvpQueueRow(env.DB, userId, nowMs);
  const row = await loadPvpQueueRow(env.DB, userId);
  if (!row) return { status: 200, body: { state: 'IDLE' } };
  if (row.mode_id !== 'pvp_casual_2v2') return { status: 409, body: { error: 'pvp_other_queue_active' } };
  if (row.state === 'MATCHED' && row.match_id && row.team_id && row.seat_index !== null && row.paired_at !== null) {
    return matchedState(env, userId, row.match_id, row.team_id, row.seat_index, row.paired_at);
  }
  return {
    status: 200,
    body: { state: row.state, modeId: row.mode_id, queuedAtMs: row.queued_at * 1000, expiresAtMs: row.expires_at * 1000 },
  };
}

export async function resolvePvp2v2WebSocket(request: Request, env: Pvp2v2HttpEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(SOCKET_PATTERN);
  if (request.method !== 'GET' || !match) return null;
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response(JSON.stringify({ error: 'websocket_upgrade_required' }), { status: 426, headers: { 'content-type': 'application/json; charset=utf-8' } });
  return stub(env, match[1]!).fetch(request);
}

export async function resolvePvp2v2Http(request: Request, env: Pvp2v2HttpEnv, nowMs = Date.now()): Promise<Pvp2v2HttpResult | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/pvp/2v2/')) return null;
  if (SOCKET_PATTERN.test(url.pathname)) return null;
  const principal = await resolveAuthSession(env.DB, request.headers.get('authorization'), nowMs);
  if (!principal) return { status: 401, body: { error: 'authentication_required' } };
  try {
    if (request.method === 'POST' && url.pathname === '/api/pvp/2v2/matchmaking/join') {
      await getAccountPvpSeatAuthority(env.DB, principal.userId, 'pvp_casual_2v2', nowMs);
      const existing = await loadPvpQueueRow(env.DB, principal.userId);
      if (existing && existing.state !== 'QUEUED') return status(env, principal.userId, nowMs);
      await enterPublicPvpQueue(env.DB, principal.userId, 'pvp_casual_2v2', nowMs);
      const created = await tryCreatePublicPvpMatch(env.DB, principal.userId, nowMs);
      if (created && !(await initializeMatch(env, created))) return { status: 503, body: { error: 'pvp_2v2_match_initialization_failed' } };
      return status(env, principal.userId, nowMs);
    }
    if (request.method === 'GET' && url.pathname === '/api/pvp/2v2/matchmaking/status') return status(env, principal.userId, nowMs);
    if (request.method === 'POST' && url.pathname === '/api/pvp/2v2/matchmaking/leave') {
      const result = await leavePublicPvpQueue(env.DB, principal.userId);
      if (result === 'ALREADY_MATCHED') return { status: 409, body: { error: 'pvp_already_matched' } };
      return { status: 200, body: { state: 'IDLE' } };
    }
    return { status: 404, body: { error: 'not_found' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'pvp_2v2_request_failed';
    return { status: message.includes('required') || message.includes('locked') ? 403 : 400, body: { error: message } };
  }
}
