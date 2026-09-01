import type { AchievementFactId } from '@frontline/sim/achievement-profile';
import type { TrustedBattleCommand, TrustedBattleCompletionResult } from './trusted-battle-authority.ts';
import { resolveAuthenticatedAccountHttp, type AccountHttpResult } from './account-http.ts';
import { recordAccountAchievementFact } from './account-profile-authority.ts';
import { resolveAuthSession } from './auth-session-authority.ts';
import { replayTrustedCombatQuirkFacts } from './trusted-combat-quirk-replay.ts';

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseCommands(value: unknown): readonly TrustedBattleCommand[] | null {
  if (!Array.isArray(value)) return null;
  const commands: TrustedBattleCommand[] = [];
  for (const entry of value) {
    const raw = object(entry);
    if (!raw || !Number.isInteger(raw.tick) || (raw.tick as number) < 0) return null;
    const tick = raw.tick as number;
    if (raw.type === 'SPAWN' && typeof raw.slotId === 'string' && raw.slotId.trim()) {
      commands.push({ tick, type: 'SPAWN', slotId: raw.slotId.trim() });
    } else if (raw.type === 'UPGRADE_SUPPLY') commands.push({ tick, type: 'UPGRADE_SUPPLY' });
    else if (raw.type === 'FIRE_BASE_WEAPON') commands.push({ tick, type: 'FIRE_BASE_WEAPON' });
    else return null;
  }
  return commands;
}

function parseCompleteInput(value: unknown): { readonly battleId: string; readonly commands: readonly TrustedBattleCommand[] } | null {
  const raw = object(value);
  if (!raw || typeof raw.battleId !== 'string' || !raw.battleId.trim()) return null;
  const commands = parseCommands(raw.commands);
  return commands ? { battleId: raw.battleId.trim(), commands } : null;
}

function parseCompletionFromBody(value: unknown): TrustedBattleCompletionResult | null {
  const raw = object(value);
  const result = object(raw?.result);
  if (!result || typeof result.battleId !== 'string' || typeof result.kind !== 'string' || typeof result.targetId !== 'string') return null;
  return result as unknown as TrustedBattleCompletionResult;
}

async function recordFacts(
  db: D1Database,
  accountId: string,
  facts: readonly AchievementFactId[],
  nowMs: number,
): Promise<void> {
  for (const factId of facts) await recordAccountAchievementFact(db, accountId, factId, nowMs);
}

/**
 * Intercepts only the existing trusted-completion route. The canonical account HTTP handler still performs
 * authentication, request validation and the primary deterministic replay first; this wrapper then performs
 * a second deterministic attribution replay for hidden combat achievements and records server-owned facts.
 */
export async function resolveTrustedCombatQuirkCompleteHttp(
  request: Request,
  db: D1Database,
  nowMs = Date.now(),
): Promise<AccountHttpResult | null> {
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.pathname !== '/api/account/battles/complete') return null;

  const shadow = request.clone();
  const base = await resolveAuthenticatedAccountHttp(request, db, nowMs);
  if (!base || base.status !== 200) return base;

  const principal = await resolveAuthSession(db, shadow.headers.get('authorization'), nowMs);
  if (!principal) return base;

  let input: { readonly battleId: string; readonly commands: readonly TrustedBattleCommand[] } | null = null;
  try { input = parseCompleteInput(await shadow.json()); }
  catch { /* canonical handler already returned 200, so this would indicate an impossible request-body drift */ }
  const completion = parseCompletionFromBody(base.body);
  if (!input || !completion || completion.battleId !== input.battleId) {
    return { status: 500, body: { error: 'combat_quirk_completion_shape_failure' } };
  }

  try {
    const factIds = await replayTrustedCombatQuirkFacts(db, principal.userId, input.battleId, input.commands, completion);
    await recordFacts(db, principal.userId, factIds, nowMs);
    const body = object(base.body);
    return body ? { ...base, body: { ...body, achievementFactIds: factIds } } : base;
  } catch (error) {
    return {
      status: 500,
      body: {
        error: 'combat_quirk_replay_failure',
        message: error instanceof Error ? error.message : 'unknown trusted combat quirk replay failure',
      },
    };
  }
}
