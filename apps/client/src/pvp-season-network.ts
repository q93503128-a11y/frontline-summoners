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
export interface PvpSeasonHonor {
  readonly id: string;
  readonly displayName: string;
  readonly kind: 'EMBLEM' | 'FRAME' | 'TITLE' | 'BANNER' | 'HONOR';
}
export interface PvpSeasonHistoryEntry {
  readonly seasonId: string;
  readonly closedAtMs: number;
  readonly finalMmr: number;
  readonly bestMmr: number;
  readonly finalTier: PvpTierId;
  readonly placementMatches: number;
  readonly rankedWins: number;
  readonly rankedLosses: number;
  readonly rankedDraws: number;
  readonly finalRank: number | null;
  readonly honors: readonly PvpSeasonHonor[];
  readonly honorClaimed: boolean;
  readonly honorClaimedAtMs: number | null;
}
export interface PvpSeasonOverview {
  readonly seasonId: string;
  readonly phase: 'PRESEASON' | 'ACTIVE';
  readonly activeWeeksTarget: number;
  readonly settlementDaysTarget: number;
  readonly rating: PvpSeasonRatingView;
  readonly globalRank: number | null;
  readonly ratedPlayerCount: number;
  readonly placementPlayerCount: number;
  readonly tierPopulation: readonly { readonly tierId: PvpTierId; readonly players: number }[];
  readonly recentRankedMatches: readonly PvpSeasonRecentMatch[];
  readonly recentSeasonHistory: readonly PvpSeasonHistoryEntry[];
}
export interface PvpSeasonHonorClaimResult {
  readonly seasonId: string;
  readonly replayed: boolean;
  readonly honors: readonly PvpSeasonHonor[];
  readonly claimedAtMs: number;
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
async function request(path: string, init: RequestInit = {}): Promise<unknown> {
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
  return payload;
}

function parseOverview(payload: unknown): PvpSeasonOverview {
  if (!isRecord(payload) || typeof payload.seasonId !== 'string' || !isRecord(payload.rating) || !Array.isArray(payload.tierPopulation) || !Array.isArray(payload.recentRankedMatches) || !Array.isArray(payload.recentSeasonHistory)) {
    throw new Error('PvP 시즌 응답 형식이 올바르지 않습니다.');
  }
  return payload as unknown as PvpSeasonOverview;
}

export async function getPvpSeasonOverview(): Promise<PvpSeasonOverview> {
  return parseOverview(await request('/api/pvp/season'));
}

export async function claimPvpSeasonHonors(seasonId: string): Promise<PvpSeasonHonorClaimResult> {
  const payload = await request('/api/pvp/season/claim-honors', {
    method: 'POST',
    body: JSON.stringify({ seasonId }),
  });
  if (!isRecord(payload) || payload.seasonId !== seasonId || typeof payload.replayed !== 'boolean' || !Array.isArray(payload.honors) || typeof payload.claimedAtMs !== 'number') {
    throw new Error('PvP 시즌 명예 보상 응답 형식이 올바르지 않습니다.');
  }
  return payload as unknown as PvpSeasonHonorClaimResult;
}
