import type { PvpTierId } from '@frontline/sim/pvp-content';
import { getAccountClientState, refreshAuthenticatedAccount } from './account-network.ts';
import { resolveCoopApiOrigin } from './coop-network.ts';

export type PvpLeaderboardScope = 'TOP' | 'AROUND_ME' | 'FRIENDS';

export interface PvpLeaderboardEntryClient {
  readonly displayName: string;
  readonly mmr: number;
  readonly displayedTier: PvpTierId;
  readonly rankedWins: number;
  readonly rank: number;
  readonly isSelf: boolean;
}

export interface PvpLeaderboardViewClient {
  readonly seasonId: string;
  readonly scope: PvpLeaderboardScope;
  readonly selfRank: number | null;
  readonly totalPlayers: number;
  readonly entries: readonly PvpLeaderboardEntryClient[];
}

const SESSION_TOKEN_KEY = 'frontline.account.sessionToken.v1';
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function token(): string {
  if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') throw new Error('랭킹 순위표는 온라인 로그인 상태에서 확인할 수 있습니다.');
  const value = typeof window === 'undefined' ? null : window.sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!value || !SESSION_TOKEN_PATTERN.test(value)) throw new Error('로그인 세션을 찾을 수 없습니다.');
  return value;
}

function parseEntry(value: unknown): PvpLeaderboardEntryClient | null {
  if (!isRecord(value)) return null;
  if (typeof value.displayName !== 'string' || !Number.isInteger(value.mmr) || typeof value.displayedTier !== 'string'
    || !Number.isInteger(value.rankedWins) || !Number.isInteger(value.rank) || typeof value.isSelf !== 'boolean') return null;
  return value as unknown as PvpLeaderboardEntryClient;
}

function parseView(value: unknown): PvpLeaderboardViewClient {
  if (!isRecord(value) || typeof value.seasonId !== 'string'
    || (value.scope !== 'TOP' && value.scope !== 'AROUND_ME' && value.scope !== 'FRIENDS')
    || !(value.selfRank === null || Number.isInteger(value.selfRank))
    || !Number.isInteger(value.totalPlayers) || !Array.isArray(value.entries)) {
    throw new Error('PvP 순위표 응답 형식이 올바르지 않습니다.');
  }
  const entries = value.entries.map(parseEntry);
  if (entries.some((entry) => entry === null)) throw new Error('PvP 순위표 항목 형식이 올바르지 않습니다.');
  return {
    seasonId: value.seasonId,
    scope: value.scope,
    selfRank: value.selfRank as number | null,
    totalPlayers: value.totalPlayers as number,
    entries: entries as PvpLeaderboardEntryClient[],
  };
}

export async function getPvpLeaderboardView(
  scope: PvpLeaderboardScope,
  options: { readonly limit?: number; readonly radius?: number } = {},
): Promise<PvpLeaderboardViewClient> {
  const params = new URLSearchParams();
  params.set('scope', scope === 'AROUND_ME' ? 'around' : scope.toLowerCase());
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.radius !== undefined) params.set('radius', String(options.radius));
  const response = await fetch(`${resolveCoopApiOrigin()}/api/pvp/leaderboard/view?${params.toString()}`, {
    headers: { authorization: `Bearer ${token()}` },
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) await refreshAuthenticatedAccount();
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : `HTTP_${response.status}`;
    throw new Error(code);
  }
  return parseView(payload);
}

export const __pvpLeaderboardNetworkTestOnly = { parseView, parseEntry };
