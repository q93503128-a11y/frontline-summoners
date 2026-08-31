import {
  beginPvpSeasonSettlement,
  finalizeCurrentPvpSeasonSettlement,
  getPvpSeasonOperationsSnapshot,
  reopenPvpSeasonBeforeFinalization,
  rollFinalizedPvpSeasonAfterDeploy,
} from './pvp-season-operations-authority.ts';

export interface PvpSeasonOperationsHttpEnv {
  readonly DB: D1Database;
  readonly PVP_OPERATIONS_TOKEN?: string;
}

export interface PvpSeasonOperationsHttpResult {
  readonly status: number;
  readonly body: unknown;
}

const BASE_PATH = '/api/internal/pvp-season-operations';

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

function configuredToken(env: PvpSeasonOperationsHttpEnv): string | null {
  const value = env.PVP_OPERATIONS_TOKEN?.trim();
  return value && value.length >= 24 ? value : null;
}

function authorized(request: Request, env: PvpSeasonOperationsHttpEnv): 'OK' | 'UNCONFIGURED' | 'DENIED' {
  const expected = configuredToken(env);
  if (!expected) return 'UNCONFIGURED';
  const authorization = request.headers.get('authorization');
  return authorization === `Bearer ${expected}` ? 'OK' : 'DENIED';
}

function statusForError(message: string): number {
  if (message.includes('live_activity')) return 409;
  if (message.includes('conflict') || message.includes('mismatch') || message.includes('already') || message.includes('not_ready') || message.includes('not_started')) return 409;
  if (message.includes('deploy_required') || message.includes('code_mismatch')) return 409;
  if (message.includes('must be')) return 400;
  return 400;
}

export async function resolvePvpSeasonOperationsHttp(
  request: Request,
  env: PvpSeasonOperationsHttpEnv,
  nowMs = Date.now(),
): Promise<PvpSeasonOperationsHttpResult | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(BASE_PATH)) return null;

  const auth = authorized(request, env);
  if (auth === 'UNCONFIGURED') return { status: 503, body: { error: 'pvp_operations_token_not_configured' } };
  if (auth === 'DENIED') return { status: 401, body: { error: 'pvp_operations_authentication_required' } };

  try {
    if (request.method === 'GET' && url.pathname === BASE_PATH) {
      return { status: 200, body: await getPvpSeasonOperationsSnapshot(env.DB, nowMs) };
    }

    if (request.method === 'POST' && url.pathname === `${BASE_PATH}/begin`) {
      const body = await readJson(request);
      if (typeof body.nextSeasonId !== 'string' || body.nextSeasonId.trim().length === 0) {
        return { status: 400, body: { error: 'pvp_next_season_id_required' } };
      }
      return { status: 200, body: await beginPvpSeasonSettlement(env.DB, body.nextSeasonId, nowMs) };
    }

    if (request.method === 'POST' && url.pathname === `${BASE_PATH}/finalize`) {
      return { status: 200, body: await finalizeCurrentPvpSeasonSettlement(env.DB, nowMs) };
    }

    if (request.method === 'POST' && url.pathname === `${BASE_PATH}/roll`) {
      return { status: 200, body: await rollFinalizedPvpSeasonAfterDeploy(env.DB, nowMs) };
    }

    if (request.method === 'POST' && url.pathname === `${BASE_PATH}/reopen`) {
      return { status: 200, body: await reopenPvpSeasonBeforeFinalization(env.DB, nowMs) };
    }

    return { status: 404, body: { error: 'not_found' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'pvp_season_operations_failed';
    return { status: statusForError(message), body: { error: message } };
  }
}

export const __pvpSeasonOperationsHttpTestOnly = {
  BASE_PATH,
  configuredToken,
  authorized,
  statusForError,
};
