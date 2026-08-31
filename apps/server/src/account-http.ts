import { BASE_WEAPON_IDS, type BaseWeaponId } from '@frontline/sim/playable';
import type { ProfileLoadout } from '@frontline/sim/achievement-profile';
import { initializeAccountSave } from './account-save-authority.ts';
import {
  applyAccountMetaProgression,
  type AccountMetaMutationInput,
} from './account-meta-mutation-authority.ts';
import {
  applyAccountRecruitment,
  type AccountDuplicatePolicy,
  type AccountRecruitmentMutationInput,
} from './account-mutation-authority.ts';
import {
  applyAccountProfileLoadout,
  initializeAccountProfile,
  type AccountProfileMutationInput,
} from './account-profile-authority.ts';
import {
  applyAccountSweep,
  type AccountSweepMutationInput,
} from './account-special-mutation-authority.ts';
import {
  resolveAuthSession,
  revokeAuthSession,
  type AuthSessionPrincipal,
} from './auth-session-authority.ts';
import {
  claimTrustedBattle,
  completeTrustedBattle,
  startTrustedBattle,
  TRUSTED_BATTLE_KINDS,
  type TrustedBattleCommand,
  type TrustedBattleKind,
} from './trusted-battle-authority.ts';

export interface AccountHttpResult {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

class AccountRequestError extends Error {}

const ACCOUNT_PATHS = new Set([
  '/api/account',
  '/api/account/meta',
  '/api/account/profile',
  '/api/account/recruitment',
  '/api/account/sweep',
  '/api/account/logout',
  '/api/account/battles/start',
  '/api/account/battles/complete',
  '/api/account/battles/claim',
]);
const BASE_WEAPON_SET = new Set<string>(BASE_WEAPON_IDS);
const DUPLICATE_POLICIES = new Set<string>(['APPLY_PLUS', 'DISMANTLE']);
const TRUSTED_BATTLE_KIND_SET = new Set<string>(TRUSTED_BATTLE_KINDS);

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new AccountRequestError('request body must be an object');
  return value as Record<string, unknown>;
}

function string(value: unknown, name: string, max = 128): string {
  if (typeof value !== 'string') throw new AccountRequestError(`${name} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max) throw new AccountRequestError(`${name} must be 1..${max} characters`);
  return trimmed;
}

function optionalString(value: unknown, name: string, max = 128): string | undefined {
  return value === undefined ? undefined : string(value, name, max);
}

function integer(value: unknown, name: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new AccountRequestError(`${name} must be an integer in ${min}..${max}`);
  }
  return value as number;
}

function stringArray(value: unknown, name: string, maxLength: number): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxLength) {
    throw new AccountRequestError(`${name} must contain 1..${maxLength} strings`);
  }
  return value.map((entry, index) => string(entry, `${name}[${index}]`));
}

function optionalStringArray(value: unknown, name: string, maxLength: number): readonly string[] {
  if (!Array.isArray(value) || value.length > maxLength) throw new AccountRequestError(`${name} must contain 0..${maxLength} strings`);
  return value.map((entry, index) => string(entry, `${name}[${index}]`));
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return object(await request.json() as unknown);
  } catch (error) {
    if (error instanceof AccountRequestError) throw error;
    throw new AccountRequestError('request body must be valid JSON');
  }
}

function commonMutationFields(raw: Record<string, unknown>): { requestId: string; expectedRevision: number } {
  return {
    requestId: string(raw.requestId, 'requestId'),
    expectedRevision: integer(raw.expectedRevision, 'expectedRevision', 0, Number.MAX_SAFE_INTEGER),
  };
}

function parseMetaMutation(value: unknown): AccountMetaMutationInput {
  const raw = object(value);
  const common = commonMutationFields(raw);
  const action = string(raw.action, 'action', 64);
  if (action === 'CHARACTER_LEVEL') {
    return { ...common, action, characterId: string(raw.characterId, 'characterId'), targetLevel: integer(raw.targetLevel, 'targetLevel', 1, 50) };
  }
  if (action === 'CHARACTER_PLUS_LEVEL') {
    return { ...common, action, characterId: string(raw.characterId, 'characterId'), targetPlusLevel: integer(raw.targetPlusLevel, 'targetPlusLevel', 0, 50) };
  }
  if (action === 'EVOLUTION_UNLOCK' || action === 'EVOLUTION_SELECT') {
    return { ...common, action, characterId: string(raw.characterId, 'characterId'), formId: string(raw.formId, 'formId') };
  }
  if (action === 'DECK_SET') {
    return { ...common, action, deckSlotIds: stringArray(raw.deckSlotIds, 'deckSlotIds', 10) };
  }
  if (action === 'BASE_WEAPON_SELECT') {
    const baseWeaponId = string(raw.baseWeaponId, 'baseWeaponId');
    if (!BASE_WEAPON_SET.has(baseWeaponId)) throw new AccountRequestError('baseWeaponId is unknown');
    return { ...common, action, baseWeaponId: baseWeaponId as BaseWeaponId };
  }
  throw new AccountRequestError(`unknown account meta action:${action}`);
}

function parseProfileLoadout(value: unknown): ProfileLoadout {
  const raw = object(value);
  const portraitCharacterId = optionalString(raw.portraitCharacterId, 'profileLoadout.portraitCharacterId');
  const titleId = optionalString(raw.titleId, 'profileLoadout.titleId');
  const frameId = string(raw.frameId, 'profileLoadout.frameId');
  const bannerId = string(raw.bannerId, 'profileLoadout.bannerId');
  const emblemId = string(raw.emblemId, 'profileLoadout.emblemId');
  const badgeIds = optionalStringArray(raw.badgeIds, 'profileLoadout.badgeIds', 3);
  return {
    ...(portraitCharacterId === undefined ? {} : { portraitCharacterId }),
    ...(titleId === undefined ? {} : { titleId }),
    frameId,
    bannerId,
    emblemId,
    badgeIds,
  };
}

function parseProfileMutation(value: unknown): AccountProfileMutationInput {
  const raw = object(value);
  return {
    ...commonMutationFields(raw),
    profileLoadout: parseProfileLoadout(raw.profileLoadout),
  };
}

function parseRecruitmentMutation(value: unknown): AccountRecruitmentMutationInput {
  const raw = object(value);
  const common = commonMutationFields(raw);
  const count = integer(raw.count, 'count', 1, 10);
  if (count !== 1 && count !== 10) throw new AccountRequestError('count must be 1 or 10');
  const duplicatePolicy = string(raw.duplicatePolicy, 'duplicatePolicy', 32);
  if (!DUPLICATE_POLICIES.has(duplicatePolicy)) throw new AccountRequestError('duplicatePolicy is unknown');
  return {
    ...common,
    bannerId: string(raw.bannerId, 'bannerId'),
    count,
    duplicatePolicy: duplicatePolicy as AccountDuplicatePolicy,
  };
}

function parseSweepMutation(value: unknown): AccountSweepMutationInput {
  const raw = object(value);
  return { ...commonMutationFields(raw), stageId: string(raw.stageId, 'stageId') };
}

function parseBattleStart(value: unknown): { kind: TrustedBattleKind; targetId: string } {
  const raw = object(value);
  const kind = string(raw.kind, 'kind', 16);
  if (!TRUSTED_BATTLE_KIND_SET.has(kind)) throw new AccountRequestError('kind must be MAIN or SPECIAL');
  return { kind: kind as TrustedBattleKind, targetId: string(raw.targetId, 'targetId') };
}

function parseBattleCommand(value: unknown, index: number): TrustedBattleCommand {
  const raw = object(value);
  const tick = integer(raw.tick, `commands[${index}].tick`, 0, Number.MAX_SAFE_INTEGER);
  const type = string(raw.type, `commands[${index}].type`, 32);
  if (type === 'SPAWN') return { tick, type, slotId: string(raw.slotId, `commands[${index}].slotId`) };
  if (type === 'UPGRADE_SUPPLY') return { tick, type };
  if (type === 'FIRE_BASE_WEAPON') return { tick, type };
  throw new AccountRequestError(`unknown battle command type:${type}`);
}

function parseBattleComplete(value: unknown): { battleId: string; commands: readonly TrustedBattleCommand[] } {
  const raw = object(value);
  if (!Array.isArray(raw.commands)) throw new AccountRequestError('commands must be an array');
  return {
    battleId: string(raw.battleId, 'battleId'),
    commands: raw.commands.map((command, index) => parseBattleCommand(command, index)),
  };
}

function parseBattleClaim(value: unknown): { battleId: string; expectedRevision: number } {
  const raw = object(value);
  return {
    battleId: string(raw.battleId, 'battleId'),
    expectedRevision: integer(raw.expectedRevision, 'expectedRevision', 0, Number.MAX_SAFE_INTEGER),
  };
}

function successMutation(result: Awaited<ReturnType<typeof applyAccountMetaProgression>> | Awaited<ReturnType<typeof applyAccountRecruitment>> | Awaited<ReturnType<typeof applyAccountSweep>>): AccountHttpResult {
  if (!result.ok) {
    return { status: 409, body: { error: 'revision_conflict', currentRevision: result.currentRevision } };
  }
  return {
    status: 200,
    body: {
      replayed: result.replayed,
      revision: result.record.revision,
      schemaVersion: result.record.snapshot.schemaVersion,
      snapshot: result.record.snapshot,
      result: result.result,
    },
  };
}

function profileBody(record: Awaited<ReturnType<typeof initializeAccountProfile>>): Readonly<Record<string, unknown>> {
  return {
    revision: record.revision,
    schemaVersion: record.snapshot.schemaVersion,
    profile: record.snapshot,
    evaluations: record.evaluations,
    completedCount: record.completedCount,
  };
}

function successProfileMutation(result: Awaited<ReturnType<typeof applyAccountProfileLoadout>>): AccountHttpResult {
  if (!result.ok) return { status: 409, body: { error: 'revision_conflict', currentRevision: result.currentRevision } };
  return {
    status: 200,
    body: {
      replayed: result.replayed,
      ...profileBody(result.record),
      result: result.result,
    },
  };
}

function isServerStateFailure(message: string): boolean {
  return message.includes('stored account')
    || message.includes('committed without expected')
    || message.includes('batch returned incomplete')
    || message.includes('did not commit both rows')
    || message.includes('revision is behind mutation receipt')
    || message.includes('account save missing for mutation receipt')
    || message.includes('account profile revision is behind mutation receipt')
    || message.includes('trusted battle start snapshot JSON is invalid')
    || message.includes('trusted battle result JSON is invalid')
    || message.startsWith('D1_');
}

function errorResult(error: unknown): AccountHttpResult {
  if (error instanceof AccountRequestError) return { status: 400, body: { error: 'invalid_request', message: error.message } };
  const message = error instanceof Error ? error.message : 'unknown account mutation error';
  if (message.includes('idempotency key reused with different input')) {
    return { status: 409, body: { error: 'idempotency_conflict' } };
  }
  if (message.includes('trusted battle completion replay differs') || message.includes('trusted battle completion race differs')) {
    return { status: 409, body: { error: 'battle_proof_conflict' } };
  }
  if (message.includes('trusted battle expired')) return { status: 410, body: { error: 'battle_expired' } };
  if (message.includes('too many active trusted battles')) return { status: 429, body: { error: 'too_many_active_battles' } };
  if (isServerStateFailure(message)) return { status: 500, body: { error: 'account_state_failure' } };
  return { status: 400, body: { error: 'invalid_mutation', message } };
}

async function authenticate(request: Request, db: D1Database, nowMs: number): Promise<AuthSessionPrincipal | null> {
  return resolveAuthSession(db, request.headers.get('authorization'), nowMs);
}

export async function resolveAuthenticatedAccountHttp(
  request: Request,
  db: D1Database,
  nowMs = Date.now(),
): Promise<AccountHttpResult | null> {
  const url = new URL(request.url);
  if (!ACCOUNT_PATHS.has(url.pathname)) return null;

  const principal = await authenticate(request, db, nowMs);
  if (!principal) {
    return { status: 401, body: { error: 'authentication_required' }, headers: { 'www-authenticate': 'Bearer' } };
  }

  try {
    if (request.method === 'GET' && url.pathname === '/api/account') {
      const record = await initializeAccountSave(db, principal.userId, undefined, nowMs);
      return {
        status: 200,
        body: {
          state: 'AUTHENTICATED_ONLINE',
          revision: record.revision,
          schemaVersion: record.snapshot.schemaVersion,
          snapshot: record.snapshot,
        },
      };
    }

    if (request.method === 'GET' && url.pathname === '/api/account/profile') {
      return { status: 200, body: profileBody(await initializeAccountProfile(db, principal.userId, nowMs)) };
    }

    if (request.method === 'POST' && url.pathname === '/api/account/logout') {
      await revokeAuthSession(db, principal);
      return { status: 200, body: { ok: true } };
    }

    if (request.method === 'POST' && url.pathname === '/api/account/meta') {
      return successMutation(await applyAccountMetaProgression(db, principal.userId, parseMetaMutation(await readBody(request)), nowMs));
    }

    if (request.method === 'POST' && url.pathname === '/api/account/profile') {
      return successProfileMutation(await applyAccountProfileLoadout(db, principal.userId, parseProfileMutation(await readBody(request)), nowMs));
    }

    if (request.method === 'POST' && url.pathname === '/api/account/recruitment') {
      return successMutation(await applyAccountRecruitment(db, principal.userId, parseRecruitmentMutation(await readBody(request)), undefined, nowMs));
    }

    if (request.method === 'POST' && url.pathname === '/api/account/sweep') {
      return successMutation(await applyAccountSweep(db, principal.userId, parseSweepMutation(await readBody(request)), nowMs));
    }

    if (request.method === 'POST' && url.pathname === '/api/account/battles/start') {
      const input = parseBattleStart(await readBody(request));
      const result = await startTrustedBattle(db, principal.userId, input.kind, input.targetId, nowMs);
      return { status: 201, body: result };
    }

    if (request.method === 'POST' && url.pathname === '/api/account/battles/complete') {
      const input = parseBattleComplete(await readBody(request));
      const result = await completeTrustedBattle(db, principal.userId, input.battleId, input.commands, nowMs);
      return { status: 200, body: result };
    }

    if (request.method === 'POST' && url.pathname === '/api/account/battles/claim') {
      const input = parseBattleClaim(await readBody(request));
      const result = await claimTrustedBattle(db, principal.userId, input.battleId, input.expectedRevision, nowMs);
      if (!result.ok) return { status: 409, body: { error: 'revision_conflict', currentRevision: result.currentRevision } };
      return {
        status: 200,
        body: {
          replayed: result.replayed,
          awarded: result.awarded,
          completion: result.completion,
          revision: result.record.revision,
          schemaVersion: result.record.snapshot.schemaVersion,
          snapshot: result.record.snapshot,
          result: result.result,
        },
      };
    }

    return { status: 405, body: { error: 'method_not_allowed' }, headers: { allow: url.pathname === '/api/account' || url.pathname === '/api/account/profile' ? 'GET,POST' : 'POST' } };
  } catch (error) {
    return errorResult(error);
  }
}

export const __accountHttpTestOnly = {
  parseMetaMutation,
  parseProfileMutation,
  parseRecruitmentMutation,
  parseSweepMutation,
  parseBattleStart,
  parseBattleComplete,
  parseBattleClaim,
};
