import { BASE_WEAPON_IDS, type BaseWeaponId } from '@frontline/sim/playable';
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
  applyAccountSweep,
  type AccountSweepMutationInput,
} from './account-special-mutation-authority.ts';
import {
  resolveAuthSession,
  revokeAuthSession,
  type AuthSessionPrincipal,
} from './auth-session-authority.ts';

export interface AccountHttpResult {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

class AccountRequestError extends Error {}

const ACCOUNT_PATHS = new Set([
  '/api/account',
  '/api/account/meta',
  '/api/account/recruitment',
  '/api/account/sweep',
  '/api/account/logout',
]);
const BASE_WEAPON_SET = new Set<string>(BASE_WEAPON_IDS);
const DUPLICATE_POLICIES = new Set<string>(['APPLY_PLUS', 'DISMANTLE']);

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

function isServerStateFailure(message: string): boolean {
  return message.includes('stored account')
    || message.includes('committed without expected')
    || message.includes('batch returned incomplete')
    || message.includes('did not commit both rows')
    || message.includes('revision is behind mutation receipt')
    || message.includes('account save missing for mutation receipt')
    || message.startsWith('D1_');
}

function errorResult(error: unknown): AccountHttpResult {
  if (error instanceof AccountRequestError) return { status: 400, body: { error: 'invalid_request', message: error.message } };
  const message = error instanceof Error ? error.message : 'unknown account mutation error';
  if (message.includes('idempotency key reused with different input')) {
    return { status: 409, body: { error: 'idempotency_conflict' } };
  }
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

    if (request.method === 'POST' && url.pathname === '/api/account/logout') {
      await revokeAuthSession(db, principal);
      return { status: 200, body: { ok: true } };
    }

    if (request.method === 'POST' && url.pathname === '/api/account/meta') {
      return successMutation(await applyAccountMetaProgression(db, principal.userId, parseMetaMutation(await readBody(request)), nowMs));
    }

    if (request.method === 'POST' && url.pathname === '/api/account/recruitment') {
      return successMutation(await applyAccountRecruitment(db, principal.userId, parseRecruitmentMutation(await readBody(request)), undefined, nowMs));
    }

    if (request.method === 'POST' && url.pathname === '/api/account/sweep') {
      return successMutation(await applyAccountSweep(db, principal.userId, parseSweepMutation(await readBody(request)), nowMs));
    }

    return { status: 405, body: { error: 'method_not_allowed' }, headers: { allow: url.pathname === '/api/account' ? 'GET' : 'POST' } };
  } catch (error) {
    return errorResult(error);
  }
}

export const __accountHttpTestOnly = {
  parseMetaMutation,
  parseRecruitmentMutation,
  parseSweepMutation,
};
