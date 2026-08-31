import type { Pvp2v2SeatId } from '@frontline/sim/pvp-2v2-playable';
import { getAccountClientState, refreshAuthenticatedAccount } from './account-network.ts';
import { resolveCoopApiOrigin } from './coop-network.ts';

export type FriendlyPvp2v2LobbyState =
  | {
      readonly state: 'WAITING';
      readonly modeId: 'pvp_friendly_2v2';
      readonly inviteCode: string;
      readonly participantCount: number;
      readonly seatId: Pvp2v2SeatId | null;
      readonly expiresAtMs: number;
      readonly host: boolean;
    }
  | {
      readonly state: 'MATCHED';
      readonly modeId: 'pvp_friendly_2v2';
      readonly inviteCode: string;
      readonly matchId: string;
      readonly participantCount: 4;
      readonly seatId: Pvp2v2SeatId;
      readonly host: boolean;
      readonly websocketPath: string;
    };

const SESSION_TOKEN_KEY = 'frontline.account.sessionToken.v1';
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function sessionToken(): string {
  if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') throw new Error('2v2 친선전은 온라인 로그인 상태에서만 사용할 수 있습니다.');
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
function seat(value: unknown): Pvp2v2SeatId | null { return value === 'A1' || value === 'A2' || value === 'B1' || value === 'B2' ? value : null; }
function parseState(value: unknown): FriendlyPvp2v2LobbyState {
  if (!isRecord(value) || value.modeId !== 'pvp_friendly_2v2' || typeof value.state !== 'string' || typeof value.inviteCode !== 'string') throw new Error('2v2 친선전 응답 형식이 올바르지 않습니다.');
  if (value.state === 'WAITING') {
    if (typeof value.participantCount !== 'number' || typeof value.expiresAtMs !== 'number' || typeof value.host !== 'boolean') throw new Error('2v2 친선전 대기 응답 형식이 올바르지 않습니다.');
    return { state: 'WAITING', modeId: 'pvp_friendly_2v2', inviteCode: value.inviteCode, participantCount: value.participantCount, seatId: seat(value.seatId), expiresAtMs: value.expiresAtMs, host: value.host };
  }
  if (value.state === 'MATCHED') {
    const seatId = seat(value.seatId);
    if (!seatId || typeof value.matchId !== 'string' || typeof value.websocketPath !== 'string' || typeof value.host !== 'boolean') throw new Error('2v2 친선전 매치 응답 형식이 올바르지 않습니다.');
    return { state: 'MATCHED', modeId: 'pvp_friendly_2v2', inviteCode: value.inviteCode, matchId: value.matchId, participantCount: 4, seatId, host: value.host, websocketPath: value.websocketPath };
  }
  throw new Error(`알 수 없는 2v2 친선전 상태: ${value.state}`);
}

export async function createFriendlyPvp2v2Lobby(): Promise<FriendlyPvp2v2LobbyState> {
  return parseState(await request('/api/pvp/friendly-2v2/create', { method: 'POST' }));
}
export async function joinFriendlyPvp2v2Lobby(inviteCode: string): Promise<FriendlyPvp2v2LobbyState> {
  return parseState(await request('/api/pvp/friendly-2v2/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }));
}
export async function getFriendlyPvp2v2LobbyStatus(inviteCode: string): Promise<FriendlyPvp2v2LobbyState> {
  return parseState(await request(`/api/pvp/friendly-2v2/status?inviteCode=${encodeURIComponent(inviteCode)}`));
}
export async function cancelFriendlyPvp2v2Lobby(inviteCode: string): Promise<void> {
  await request('/api/pvp/friendly-2v2/cancel', { method: 'POST', body: JSON.stringify({ inviteCode }) });
}

export const __friendlyPvp2v2NetworkTestOnly = { parseState };
