import type { PvpTierId } from '@frontline/sim/pvp-content';
import { getAccountClientState, refreshAuthenticatedAccount } from './account-network.ts';
import { resolveCoopApiOrigin } from './coop-network.ts';

export interface PvpSeasonRatingView {
  readonly seasonId: string;
  readonly mmr: number;
  readonly bestMmr: number;
  readonly displayedTier: PvpTierId;
  readonly placementMatches: number;
  readonly placementComplete: boolean;
  readonly rankedWins: number;
  readonly rankedLosses: number;
  readonly rankedDraws: number;
}
export interface PvpSeasonRecentMatch {
  readonly matchId: string;
  readonly completedAtMs: number;
  readonly opponentUserId: string;
  readonly opponentDisplayName: string;
  readonly result: 'WIN' | 'LOSS' | 'DRAW';
  readonly mmrBefore: number | null;
  readonly mmrAfter: number | null;
  readonly mmrDelta: number | null;
}
export interface PvpSeasonOverview {
  readonly seasonId: string;
  readonly phase: 'PRESEASON';
  readonly activeWeeksTarget: number;
  readonly settlementDaysTarget: number;
  readonly rating: PvpSeasonRatingView;
  readonly globalRank: number | null;
  readonly ratedPlayerCount: number;
  readonly placementPlayerCount: number;
  readonly tierPopulation: readonly { readonly tierId: PvpTierId; readonly players: number }[];
  readonly recentRankedMatches: readonly PvpSeasonRecentMatch[];
}

const SESSION_TOKEN_KEY = 'frontline.account.sessionToken.v1';
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function token(): string {
  if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') throw new Error('시즌 정보는 온라인 로그인 상태에서 확인할 수 있습니다.');
  const value = typeof window === 'undefined' ? null : window.sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!value || !SESSION_TOKEN_PATTERN.test(value)) throw new Error('로그인 세션을 찾을 수 없습니다.');
  return value;
}

export async function getPvpSeasonOverview(): Promise<PvpSeasonOverview> {
  const response = await fetch(`${resolveCoopApiOrigin()}/api/pvp/season`, { headers: { authorization: `Bearer ${token()}` } });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) await refreshAuthenticatedAccount();
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : `HTTP_${response.status}`;
    throw new Error(code);
  }
  if (!isRecord(payload) || typeof payload.seasonId !== 'string' || !isRecord(payload.rating) || !Array.isArray(payload.tierPopulation) || !Array.isArray(payload.recentRankedMatches)) {
    throw new Error('PvP 시즌 응답 형식이 올바르지 않습니다.');
  }
  return payload as unknown as PvpSeasonOverview;
}
