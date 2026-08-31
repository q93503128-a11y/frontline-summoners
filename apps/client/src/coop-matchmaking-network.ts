import { getAccountClientState, refreshAuthenticatedAccount } from './account-network';
import { resolveCoopApiOrigin } from './coop-network';

export type PublicCoopMatchmakingState =
  | { readonly state: 'IDLE' }
  | { readonly state: 'QUEUED' | 'PAIRING'; readonly stageId: string; readonly queuedAtMs: number; readonly expiresAtMs: number }
  | { readonly state: 'MATCHED'; readonly stageId: string; readonly matchId: string; readonly seatId: 'A' | 'B'; readonly websocketPath: string; readonly matchedAtMs: number };

const SESSION_TOKEN_KEY = 'frontline.account.sessionToken.v1';
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function token(): string {
  if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') throw new Error('공개 협동 매칭은 온라인 로그인 상태에서만 사용할 수 있습니다.');
  const value = typeof window === 'undefined' ? null : window.sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!value || !SESSION_TOKEN_PATTERN.test(value)) throw new Error('로그인 세션을 찾을 수 없습니다.');
  return value;
}

function parseState(value: unknown): PublicCoopMatchmakingState {
  if (!isRecord(value) || typeof value.state !== 'string') throw new Error('공개 협동 매칭 응답 형식이 올바르지 않습니다.');
  if (value.state === 'IDLE') return { state: 'IDLE' };
  if (value.state === 'QUEUED' || value.state === 'PAIRING') {
    if (typeof value.stageId !== 'string' || typeof value.queuedAtMs !== 'number' || typeof value.expiresAtMs !== 'number') {
      throw new Error('공개 협동 대기열 응답 형식이 올바르지 않습니다.');
    }
    return { state: value.state, stageId: value.stageId, queuedAtMs: value.queuedAtMs, expiresAtMs: value.expiresAtMs };
  }
  if (value.state === 'MATCHED') {
    if (typeof value.stageId !== 'string' || typeof value.matchId !== 'string' || (value.seatId !== 'A' && value.seatId !== 'B') || typeof value.websocketPath !== 'string' || typeof value.matchedAtMs !== 'number') {
      throw new Error('공개 협동 매칭 완료 응답 형식이 올바르지 않습니다.');
    }
    return {
      state: 'MATCHED', stageId: value.stageId, matchId: value.matchId, seatId: value.seatId,
      websocketPath: value.websocketPath, matchedAtMs: value.matchedAtMs,
    };
  }
  throw new Error(`알 수 없는 공개 협동 매칭 상태: ${value.state}`);
}

async function request(path: string, init: RequestInit = {}): Promise<PublicCoopMatchmakingState> {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token()}`);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  const response = await fetch(`${resolveCoopApiOrigin()}${path}`, { ...init, headers });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) await refreshAuthenticatedAccount();
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : `HTTP_${response.status}`;
    throw new Error(code);
  }
  return parseState(payload);
}

export function joinPublicCoopMatchmaking(stageId: string): Promise<PublicCoopMatchmakingState> {
  return request('/api/coop/matchmaking/join', { method: 'POST', body: JSON.stringify({ stageId }) });
}

export function getPublicCoopMatchmakingStatus(): Promise<PublicCoopMatchmakingState> {
  return request('/api/coop/matchmaking/status');
}

export function leavePublicCoopMatchmaking(): Promise<PublicCoopMatchmakingState> {
  return request('/api/coop/matchmaking/leave', { method: 'POST' });
}

export const __coopMatchmakingNetworkTestOnly = { parseState };
