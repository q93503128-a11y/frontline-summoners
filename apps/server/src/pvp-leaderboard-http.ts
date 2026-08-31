import { resolveAuthSession } from './auth-session-authority.ts';
import {
  getPvpLeaderboardView,
  type PvpLeaderboardScope,
  type PvpLeaderboardView,
} from './pvp-leaderboard-authority.ts';

export interface PvpLeaderboardHttpEnv {
  readonly DB: D1Database;
}

export interface PvpLeaderboardHttpResult {
  readonly status: number;
  readonly body: unknown;
}

const LEADERBOARD_PATH = '/api/pvp/leaderboard/view';

function scope(value: string | null): PvpLeaderboardScope | null {
  if (value === null || value === '' || value.toLowerCase() === 'top') return 'TOP';
  if (value.toLowerCase() === 'around' || value.toLowerCase() === 'around_me') return 'AROUND_ME';
  if (value.toLowerCase() === 'friends') return 'FRIENDS';
  return null;
}

function numericQuery(value: string | null, fallback: number): number {
  if (value === null || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function publicView(view: PvpLeaderboardView): Readonly<Record<string, unknown>> {
  return {
    seasonId: view.seasonId,
    scope: view.scope,
    selfRank: view.selfRank,
    totalPlayers: view.totalPlayers,
    entries: view.entries.map(({ userId: _userId, ...entry }) => entry),
  };
}

export async function resolvePvpLeaderboardHttp(
  request: Request,
  env: PvpLeaderboardHttpEnv,
  nowMs = Date.now(),
): Promise<PvpLeaderboardHttpResult | null> {
  const url = new URL(request.url);
  if (url.pathname !== LEADERBOARD_PATH) return null;
  if (request.method !== 'GET') return { status: 405, body: { error: 'method_not_allowed' } };
  const principal = await resolveAuthSession(env.DB, request.headers.get('authorization'), nowMs);
  if (!principal) return { status: 401, body: { error: 'authentication_required' } };
  const requestedScope = scope(url.searchParams.get('scope'));
  if (!requestedScope) return { status: 400, body: { error: 'pvp_leaderboard_scope_unknown' } };
  try {
    const view = await getPvpLeaderboardView(env.DB, principal.userId, requestedScope, {
      limit: numericQuery(url.searchParams.get('limit'), 100),
      radius: numericQuery(url.searchParams.get('radius'), 5),
    });
    return { status: 200, body: publicView(view) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'pvp_leaderboard_failed';
    return { status: 400, body: { error: message } };
  }
}

export const __pvpLeaderboardHttpTestOnly = { scope, numericQuery, publicView };
