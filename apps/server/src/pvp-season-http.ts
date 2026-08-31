import { resolveAuthSession } from './auth-session-authority.ts';
import { claimPvpSeasonHonors, getPvpSeasonOverview } from './pvp-season-authority.ts';

export interface PvpSeasonHttpEnv { readonly DB: D1Database; }
export interface PvpSeasonHttpResult { readonly status: number; readonly body: unknown; }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    return isRecord(value) ? value : {};
  } catch { return {}; }
}

export async function resolvePvpSeasonHttp(
  request: Request,
  env: PvpSeasonHttpEnv,
  nowMs = Date.now(),
): Promise<PvpSeasonHttpResult | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/pvp/season')) return null;
  const principal = await resolveAuthSession(env.DB, request.headers.get('authorization'), nowMs);
  if (!principal) return { status: 401, body: { error: 'authentication_required' } };
  try {
    if (request.method === 'GET' && url.pathname === '/api/pvp/season') {
      return { status: 200, body: await getPvpSeasonOverview(env.DB, principal.userId, nowMs) };
    }
    if (request.method === 'POST' && url.pathname === '/api/pvp/season/claim-honors') {
      const body = await readJson(request);
      if (typeof body.seasonId !== 'string' || body.seasonId.trim().length === 0) {
        return { status: 400, body: { error: 'pvp_season_id_required' } };
      }
      return { status: 200, body: await claimPvpSeasonHonors(env.DB, principal.userId, body.seasonId, nowMs) };
    }
    return { status: 404, body: { error: 'not_found' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'pvp_season_request_failed';
    return { status: message.includes('not_found') ? 404 : 400, body: { error: message } };
  }
}
