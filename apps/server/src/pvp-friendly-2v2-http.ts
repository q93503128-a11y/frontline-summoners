import { PVP_2V2_SEAT_IDS, type Pvp2v2SeatId } from '@frontline/sim/pvp-2v2-playable';
import { resolveAuthSession } from './auth-session-authority.ts';
import type { Pvp2v2Room } from './pvp-2v2-durable-room.ts';
import {
  cancelFriendlyPvp2v2Lobby,
  createFriendlyPvp2v2Lobby,
  ensureFriendlyPvp2v2DatabaseMatch,
  getFriendlyPvp2v2SeatForAccount,
  joinFriendlyPvp2v2Lobby,
  loadFriendlyPvp2v2Lobby,
  normalizeFriendlyPvp2v2InviteCode,
  type FriendlyPvp2v2LobbyView,
} from './pvp-friendly-2v2-authority.ts';

export interface FriendlyPvp2v2HttpEnv {
  readonly DB: D1Database;
  readonly PVP_2V2_ROOM: DurableObjectNamespace<Pvp2v2Room>;
}

export interface FriendlyPvp2v2HttpResult { readonly status: number; readonly body: unknown; }

const SOCKET_PATTERN = /^\/api\/pvp\/friendly-2v2\/(P2-[A-F0-9]{10})\/websocket$/;

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
async function readJson(request: Request): Promise<Record<string, unknown>> { try { const value: unknown = await request.json(); return isRecord(value) ? value : {}; } catch { return {}; } }
function makeInviteCode(): string { return `P2-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`; }
function roomStub(env: FriendlyPvp2v2HttpEnv, matchId: string) { return env.PVP_2V2_ROOM.get(env.PVP_2V2_ROOM.idFromName(matchId)); }

function waitingBody(lobby: FriendlyPvp2v2LobbyView, accountId: string): FriendlyPvp2v2HttpResult {
  const seatId = getFriendlyPvp2v2SeatForAccount(lobby, accountId);
  return {
    status: 200,
    body: {
      state: lobby.state,
      modeId: 'pvp_friendly_2v2',
      inviteCode: lobby.inviteCode,
      participantCount: lobby.participantAccountIds.length,
      seatId,
      expiresAtMs: lobby.expiresAtMs,
      host: lobby.hostAccountId === accountId,
    },
  };
}

async function initializeRoom(env: FriendlyPvp2v2HttpEnv, lobby: FriendlyPvp2v2LobbyView): Promise<void> {
  if (lobby.state !== 'MATCHED' || !lobby.matchId || lobby.participantAccountIds.length !== 4) throw new Error('friendly_2v2_match_not_ready');
  const joinTokens = Object.fromEntries(PVP_2V2_SEAT_IDS.map((seatId) => [seatId, crypto.randomUUID()])) as Record<Pvp2v2SeatId, string>;
  const response = await roomStub(env, lobby.matchId).fetch(new Request('https://pvp-2v2.internal/initialize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ matchId: lobby.matchId, joinTokens }),
  }));
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: unknown };
    throw new Error(typeof payload.error === 'string' ? payload.error : 'friendly_2v2_room_initialization_failed');
  }
}

async function ensureReadyRoom(
  env: FriendlyPvp2v2HttpEnv,
  lobby: FriendlyPvp2v2LobbyView,
  nowMs: number,
): Promise<FriendlyPvp2v2LobbyView> {
  const matched = lobby.participantAccountIds.length === 4
    ? await ensureFriendlyPvp2v2DatabaseMatch(env.DB, lobby, nowMs)
    : lobby;
  if (matched.state === 'MATCHED') await initializeRoom(env, matched);
  return matched;
}

async function matchedBody(
  env: FriendlyPvp2v2HttpEnv,
  lobby: FriendlyPvp2v2LobbyView,
  accountId: string,
): Promise<FriendlyPvp2v2HttpResult> {
  if (lobby.state !== 'MATCHED' || !lobby.matchId) return waitingBody(lobby, accountId);
  const seatId = getFriendlyPvp2v2SeatForAccount(lobby, accountId);
  if (!seatId) return { status: 403, body: { error: 'friendly_2v2_not_participant' } };
  const response = await roomStub(env, lobby.matchId).fetch(new Request('https://pvp-2v2.internal/seat-token', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accountId, seatId }),
  }));
  if (!response.ok) return { status: 503, body: { error: 'friendly_2v2_room_unavailable' } };
  const payload = await response.json() as { token?: unknown };
  if (typeof payload.token !== 'string') return { status: 503, body: { error: 'friendly_2v2_seat_token_missing' } };
  return {
    status: 200,
    body: {
      state: 'MATCHED',
      modeId: 'pvp_friendly_2v2',
      inviteCode: lobby.inviteCode,
      matchId: lobby.matchId,
      participantCount: 4,
      seatId,
      host: lobby.hostAccountId === accountId,
      websocketPath: `/api/pvp/friendly-2v2/${encodeURIComponent(lobby.inviteCode)}/websocket?token=${encodeURIComponent(payload.token)}`,
    },
  };
}

export async function resolveFriendlyPvp2v2WebSocket(
  request: Request,
  env: FriendlyPvp2v2HttpEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(SOCKET_PATTERN);
  if (request.method !== 'GET' || !match) return null;
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return new Response(JSON.stringify({ error: 'websocket_upgrade_required' }), { status: 426, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
  const inviteCode = match[1]!;
  const matchId = `friendly2v2-${inviteCode}`;
  return roomStub(env, matchId).fetch(request);
}

export async function resolveFriendlyPvp2v2Http(
  request: Request,
  env: FriendlyPvp2v2HttpEnv,
  nowMs = Date.now(),
): Promise<FriendlyPvp2v2HttpResult | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/pvp/friendly-2v2')) return null;
  if (SOCKET_PATTERN.test(url.pathname)) return null;
  const principal = await resolveAuthSession(env.DB, request.headers.get('authorization'), nowMs);
  if (!principal) return { status: 401, body: { error: 'authentication_required' } };

  try {
    if (request.method === 'POST' && url.pathname === '/api/pvp/friendly-2v2/create') {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const inviteCode = makeInviteCode();
        try {
          const lobby = await createFriendlyPvp2v2Lobby(env.DB, inviteCode, principal.userId, nowMs);
          return waitingBody(lobby, principal.userId);
        } catch (error) {
          if (!(error instanceof Error) || error.message !== 'friendly_2v2_invite_code_collision') throw error;
        }
      }
      return { status: 503, body: { error: 'friendly_2v2_code_generation_failed' } };
    }

    if (request.method === 'POST' && url.pathname === '/api/pvp/friendly-2v2/join') {
      const body = await readJson(request);
      const inviteCode = normalizeFriendlyPvp2v2InviteCode(body.inviteCode);
      if (!inviteCode) return { status: 400, body: { error: 'friendly_2v2_invite_code_invalid' } };
      const joined = await joinFriendlyPvp2v2Lobby(env.DB, inviteCode, principal.userId, nowMs);
      const ready = await ensureReadyRoom(env, joined, nowMs);
      return ready.state === 'MATCHED' ? matchedBody(env, ready, principal.userId) : waitingBody(ready, principal.userId);
    }

    if (request.method === 'GET' && url.pathname === '/api/pvp/friendly-2v2/status') {
      const inviteCode = normalizeFriendlyPvp2v2InviteCode(url.searchParams.get('inviteCode'));
      if (!inviteCode) return { status: 400, body: { error: 'friendly_2v2_invite_code_invalid' } };
      const lobby = await loadFriendlyPvp2v2Lobby(env.DB, inviteCode, nowMs);
      if (!lobby) return { status: 404, body: { error: 'friendly_2v2_lobby_not_found' } };
      if (!lobby.participantAccountIds.includes(principal.userId)) return { status: 403, body: { error: 'friendly_2v2_not_participant' } };
      if (lobby.state === 'EXPIRED') return { status: 410, body: { error: 'friendly_2v2_lobby_expired' } };
      if (lobby.state === 'CANCELLED') return { status: 410, body: { error: 'friendly_2v2_lobby_cancelled' } };
      const ready = await ensureReadyRoom(env, lobby, nowMs);
      return ready.state === 'MATCHED' ? matchedBody(env, ready, principal.userId) : waitingBody(ready, principal.userId);
    }

    if (request.method === 'POST' && url.pathname === '/api/pvp/friendly-2v2/cancel') {
      const body = await readJson(request);
      const inviteCode = normalizeFriendlyPvp2v2InviteCode(body.inviteCode);
      if (!inviteCode) return { status: 400, body: { error: 'friendly_2v2_invite_code_invalid' } };
      await cancelFriendlyPvp2v2Lobby(env.DB, inviteCode, principal.userId, nowMs);
      return { status: 200, body: { state: 'CANCELLED', inviteCode } };
    }

    return { status: 404, body: { error: 'not_found' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'friendly_2v2_request_failed';
    const forbidden = message.includes('required') || message.includes('blocked') || message.includes('host_only') || message.includes('not_participant');
    const gone = message.includes('expired') || message.includes('cancelled');
    return { status: gone ? 410 : forbidden ? 403 : 400, body: { error: message } };
  }
}

export const __friendlyPvp2v2HttpTestOnly = { makeInviteCode };
