import { resolveAuthSession } from './auth-session-authority.ts';
import { getPvpSeasonOverview } from './pvp-season-authority.ts';

export interface PvpSeasonHttpEnv { readonly DB: D1Database; }
export interface PvpSeasonHttpResult { readonly status: number; readonly body: unknown; }

export async function resolvePvpSeasonHttp(
  request: Request,
  env: PvpSeasonHttpEnv,
  nowMs = Date.now(),
): Promise<PvpSeasonHttpResult | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/pvp/season') return null;
  const principal = await resolveAuthSession(env.DB, request.headers.get('authorization'), nowMs);
  if (!principal) return { status: 401, body: { error: 'authentication_required' } };
  if (request.method !== 'GET') return { status: 405, body: { error: 'method_not_allowed' } };
  try {
    return { status: 200, body: await getPvpSeasonOverview(env.DB, principal.userId, nowMs) };
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : 'pvp_season_request_failed' } };
  }
}
