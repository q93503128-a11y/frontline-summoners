import { getAccountClientState, refreshAuthenticatedAccount } from './account-network.ts';
import { resolveCoopApiOrigin } from './coop-network.ts';

export type FriendlyPvpGrowthPolicy = 'STANDARDIZED' | 'ACTUAL';

export type FriendlyPvpLobbyState =
  | {
      readonly state: 'WAITING';
      readonly modeId: 'pvp_friendly_1v1';
      readonly inviteCode: string;
      readonly growthPolicy: FriendlyPvpGrowthPolicy;
      readonly expiresAtMs: number;
    }
  | {
      readonly state: 'MATCHED';
      readonly modeId: 'pvp_friendly_1v1';
      readonly inviteCode: string;
      readonly matchId: string;
      readonly seatId: 'A' | 'B';
      readonly growthPolicy: FriendlyPvpGrowthPolicy;
      readonly websocketPath: string;
    };

const SESSION_TOKEN_KEY = 'frontline.account.sessionToken.v1';
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sessionToken(): string {
  if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') throw new Error('친선 PvP는 온라인 로그인 상태에서만 사용할 수 있습니다.');
  const value = typeof window === 'undefined' ? null : window.sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!value || !SESSION_TOKEN_PATTERN.test(value)) throw new Error('로그인 세션을 찾을 수 없습니다.');
  return value;
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${sessionToken()}`);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  const response = await fetch(`${resolveCoopApiOrigin()}${path}`, { ...init, headers });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) await refreshAuthenticatedAccount();
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : `HTTP_${response.status}`;
    throw new Error(code);
  }
  return payload;
}

function parseGrowthPolicy(value: unknown): FriendlyPvpGrowthPolicy {
  if (value === 'STANDARDIZED' || value === 'ACTUAL') return value;
  throw new Error('친선전 성장 규칙 응답이 올바르지 않습니다.');
}

function parseLobbyState(value: unknown): FriendlyPvpLobbyState {
  if (!isRecord(value) || typeof value.state !== 'string' || value.modeId !== 'pvp_friendly_1v1' || typeof value.inviteCode !== 'string') {
    throw new Error('친선 PvP 응답 형식이 올바르지 않습니다.');
  }
  const growthPolicy = parseGrowthPolicy(value.growthPolicy);
  if (value.state === 'WAITING') {
    if (typeof value.expiresAtMs !== 'number') throw new Error('친선 PvP 대기방 응답 형식이 올바르지 않습니다.');
    return {
      state: 'WAITING',
      modeId: 'pvp_friendly_1v1',
      inviteCode: value.inviteCode,
      growthPolicy,
      expiresAtMs: value.expiresAtMs,
    };
  }
  if (value.state === 'MATCHED') {
    if (typeof value.matchId !== 'string' || (value.seatId !== 'A' && value.seatId !== 'B') || typeof value.websocketPath !== 'string') {
      throw new Error('친선 PvP 매치 응답 형식이 올바르지 않습니다.');
    }
    return {
      state: 'MATCHED',
      modeId: 'pvp_friendly_1v1',
      inviteCode: value.inviteCode,
      matchId: value.matchId,
      seatId: value.seatId,
      growthPolicy,
      websocketPath: value.websocketPath,
    };
  }
  throw new Error(`알 수 없는 친선 PvP 상태: ${value.state}`);
}

export async function createFriendlyPvpLobby(growthPolicy: FriendlyPvpGrowthPolicy): Promise<FriendlyPvpLobbyState> {
  return parseLobbyState(await request('/api/pvp/friendly/create', {
    method: 'POST',
    body: JSON.stringify({ growthPolicy }),
  }));
}

export async function joinFriendlyPvpLobby(inviteCode: string): Promise<FriendlyPvpLobbyState> {
  return parseLobbyState(await request('/api/pvp/friendly/join', {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
  }));
}

export async function getFriendlyPvpLobbyStatus(inviteCode: string): Promise<FriendlyPvpLobbyState> {
  return parseLobbyState(await request(`/api/pvp/friendly/status?inviteCode=${encodeURIComponent(inviteCode)}`));
}

export async function cancelFriendlyPvpLobby(inviteCode: string): Promise<void> {
  await request('/api/pvp/friendly/cancel', {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
  });
}

export const __friendlyPvpNetworkTestOnly = { parseLobbyState, parseGrowthPolicy };
