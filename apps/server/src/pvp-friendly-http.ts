import { resolveAuthSession } from './auth-session-authority.ts';
import {
  getAccountFriendlyPvpAuthority,
  parseFriendlyPvpGrowthPolicy,
  type FriendlyPvpGrowthPolicy,
} from './pvp-friendly-authority.ts';
import type { FriendlyPvpRoom } from './pvp-friendly-durable-room.ts';

export interface FriendlyPvpHttpEnv {
  readonly DB: D1Database;
  readonly PVP_FRIENDLY_ROOM: DurableObjectNamespace<FriendlyPvpRoom>;
}

export interface FriendlyPvpHttpResult {
  readonly status: number;
  readonly body: unknown;
}

export const FRIENDLY_PVP_LOBBY_TTL_MS = 10 * 60 * 1000;
const FRIENDLY_SOCKET_PATTERN = /^\/api\/pvp\/friendly\/(PV-[A-F0-9]{10})\/websocket$/;

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

export function normalizeFriendlyPvpInviteCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return /^PV-[A-F0-9]{10}$/.test(normalized) ? normalized : null;
}

function makeInviteCode(): string {
  return `PV-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

function stub(env: FriendlyPvpHttpEnv, inviteCode: string) {
  return env.PVP_FRIENDLY_ROOM.get(env.PVP_FRIENDLY_ROOM.idFromName(inviteCode));
}

async function internalPost(
  env: FriendlyPvpHttpEnv,
  inviteCode: string,
  path: string,
  body: Readonly<Record<string, unknown>>,
): Promise<{ readonly status: number; readonly payload: Record<string, unknown> }> {
  const response = await stub(env, inviteCode).fetch(new Request(`https://friendly-pvp.internal${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
  const raw: unknown = await response.json().catch(() => ({}));
  return { status: response.status, payload: isRecord(raw) ? raw : {} };
}

function matchedBody(inviteCode: string, payload: Record<string, unknown>): FriendlyPvpHttpResult {
  const seatId = payload.seatId;
  const token = payload.token;
  const growthPolicy = payload.growthPolicy;
  if ((seatId !== 'A' && seatId !== 'B') || typeof token !== 'string' || (growthPolicy !== 'STANDARDIZED' && growthPolicy !== 'ACTUAL')) {
    return { status: 503, body: { error: 'friendly_pvp_match_payload_invalid' } };
  }
  return {
    status: 200,
    body: {
      state: 'MATCHED',
      modeId: 'pvp_friendly_1v1',
      inviteCode,
      matchId: inviteCode,
      seatId,
      growthPolicy,
      websocketPath: `/api/pvp/friendly/${encodeURIComponent(inviteCode)}/websocket?token=${encodeURIComponent(token)}`,
    },
  };
}

/** Trusted server-side lobby creation used by both the public code flow and social friend invites. */
export async function createFriendlyPvpLobbyForAccount(
  env: FriendlyPvpHttpEnv,
  accountId: string,
  growthPolicy: FriendlyPvpGrowthPolicy,
  nowMs = Date.now(),
): Promise<FriendlyPvpHttpResult> {
  await getAccountFriendlyPvpAuthority(env.DB, accountId, growthPolicy, nowMs);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const inviteCode = makeInviteCode();
    const hostToken = crypto.randomUUID();
    const expiresAtMs = nowMs + FRIENDLY_PVP_LOBBY_TTL_MS;
    const initialized = await internalPost(env, inviteCode, '/initialize-host', {
      inviteCode,
      accountId,
      growthPolicy,
      hostToken,
      expiresAtMs,
    });
    if (initialized.status === 409) continue;
    if (initialized.status >= 400) {
      const error = typeof initialized.payload.error === 'string' ? initialized.payload.error : 'friendly_pvp_initialization_failed';
      return { status: initialized.status, body: { error } };
    }
    return {
      status: 201,
      body: { state: 'WAITING', modeId: 'pvp_friendly_1v1', inviteCode, growthPolicy, expiresAtMs },
    };
  }
  return { status: 503, body: { error: 'friendly_pvp_code_generation_failed' } };
}

export async function joinFriendlyPvpLobbyForAccount(
  env: FriendlyPvpHttpEnv,
  accountId: string,
  rawInviteCode: unknown,
): Promise<FriendlyPvpHttpResult> {
  const inviteCode = normalizeFriendlyPvpInviteCode(rawInviteCode);
  if (!inviteCode) return { status: 400, body: { error: 'friendly_pvp_invite_code_invalid' } };
  const joined = await internalPost(env, inviteCode, '/join-guest', { accountId });
  if (joined.status >= 400) {
    const error = typeof joined.payload.error === 'string' ? joined.payload.error : 'friendly_pvp_join_failed';
    return { status: joined.status, body: { error } };
  }
  return matchedBody(inviteCode, joined.payload);
}

export async function getFriendlyPvpLobbyStatusForAccount(
  env: FriendlyPvpHttpEnv,
  accountId: string,
  rawInviteCode: unknown,
): Promise<FriendlyPvpHttpResult> {
  const inviteCode = normalizeFriendlyPvpInviteCode(rawInviteCode);
  if (!inviteCode) return { status: 400, body: { error: 'friendly_pvp_invite_code_invalid' } };
  const status = await internalPost(env, inviteCode, '/status', { accountId });
  if (status.status >= 400) {
    const error = typeof status.payload.error === 'string' ? status.payload.error : 'friendly_pvp_status_failed';
    return { status: status.status, body: { error } };
  }
  if (status.payload.state === 'MATCHED') return matchedBody(inviteCode, status.payload);
  if (status.payload.state === 'EXPIRED') return { status: 410, body: { error: 'friendly_pvp_lobby_expired' } };
  return {
    status: 200,
    body: {
      state: 'WAITING',
      modeId: 'pvp_friendly_1v1',
      inviteCode,
      growthPolicy: status.payload.growthPolicy as FriendlyPvpGrowthPolicy,
      expiresAtMs: status.payload.expiresAtMs,
    },
  };
}

export async function cancelFriendlyPvpLobbyForAccount(
  env: FriendlyPvpHttpEnv,
  accountId: string,
  rawInviteCode: unknown,
): Promise<FriendlyPvpHttpResult> {
  const inviteCode = normalizeFriendlyPvpInviteCode(rawInviteCode);
  if (!inviteCode) return { status: 400, body: { error: 'friendly_pvp_invite_code_invalid' } };
  const cancelled = await internalPost(env, inviteCode, '/cancel', { accountId });
  if (cancelled.status >= 400) {
    const error = typeof cancelled.payload.error === 'string' ? cancelled.payload.error : 'friendly_pvp_cancel_failed';
    return { status: cancelled.status, body: { error } };
  }
  return { status: 200, body: { state: 'CANCELLED', inviteCode } };
}

export async function resolveFriendlyPvpWebSocket(
  request: Request,
  env: FriendlyPvpHttpEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(FRIENDLY_SOCKET_PATTERN);
  if (request.method !== 'GET' || !match) return null;
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return new Response(JSON.stringify({ error: 'websocket_upgrade_required' }), {
      status: 426,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  return stub(env, match[1]!).fetch(request);
}

export async function resolveFriendlyPvpHttp(
  request: Request,
  env: FriendlyPvpHttpEnv,
  nowMs = Date.now(),
): Promise<FriendlyPvpHttpResult | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/pvp/friendly')) return null;
  if (FRIENDLY_SOCKET_PATTERN.test(url.pathname)) return null;
  const principal = await resolveAuthSession(env.DB, request.headers.get('authorization'), nowMs);
  if (!principal) return { status: 401, body: { error: 'authentication_required' } };

  try {
    if (request.method === 'POST' && url.pathname === '/api/pvp/friendly/create') {
      const body = await readJson(request);
      const growthPolicy = parseFriendlyPvpGrowthPolicy(body.growthPolicy);
      if (!growthPolicy) return { status: 400, body: { error: 'friendly_pvp_growth_policy_required' } };
      return createFriendlyPvpLobbyForAccount(env, principal.userId, growthPolicy, nowMs);
    }

    if (request.method === 'POST' && url.pathname === '/api/pvp/friendly/join') {
      const body = await readJson(request);
      return joinFriendlyPvpLobbyForAccount(env, principal.userId, body.inviteCode);
    }

    if (request.method === 'GET' && url.pathname === '/api/pvp/friendly/status') {
      return getFriendlyPvpLobbyStatusForAccount(env, principal.userId, url.searchParams.get('inviteCode'));
    }

    if (request.method === 'POST' && url.pathname === '/api/pvp/friendly/cancel') {
      const body = await readJson(request);
      return cancelFriendlyPvpLobbyForAccount(env, principal.userId, body.inviteCode);
    }

    return { status: 404, body: { error: 'not_found' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'friendly_pvp_request_failed';
    const forbidden = message.includes('required') || message.includes('locked') || message.includes('blocked') || message.includes('forbidden');
    return { status: forbidden ? 403 : 400, body: { error: message } };
  }
}

export const __friendlyPvpHttpTestOnly = { normalizeInviteCode: normalizeFriendlyPvpInviteCode, makeInviteCode };
