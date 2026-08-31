import {
  ACCOUNT_GUEST_MIGRATION_MODES,
  applyGuestAccountMigration,
  previewGuestAccountMigration,
  rollbackGuestAccountMigration,
  type AccountGuestMigrationInput,
  type AccountGuestMigrationMode,
} from './account-guest-migration-authority.ts';
import { resolveAuthSession } from './auth-session-authority.ts';

export interface GuestMigrationHttpResult {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

class MigrationRequestError extends Error {}

const MIGRATION_PATHS = new Set([
  '/api/account/migration/preview',
  '/api/account/migration/commit',
  '/api/account/migration/rollback',
]);
const MODE_SET = new Set<string>(ACCOUNT_GUEST_MIGRATION_MODES);

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new MigrationRequestError('request body must be an object');
  return value as Record<string, unknown>;
}

function string(value: unknown, name: string, max = 128): string {
  if (typeof value !== 'string') throw new MigrationRequestError(`${name} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max) throw new MigrationRequestError(`${name} must be 1..${max} characters`);
  return trimmed;
}

function integer(value: unknown, name: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new MigrationRequestError(`${name} must be a non-negative integer`);
  return value as number;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try { return object(await request.json() as unknown); }
  catch (error) {
    if (error instanceof MigrationRequestError) throw error;
    throw new MigrationRequestError('request body must be valid JSON');
  }
}

function parseMode(value: unknown): AccountGuestMigrationMode {
  const mode = string(value, 'mode', 32);
  if (!MODE_SET.has(mode)) throw new MigrationRequestError('mode is unknown');
  return mode as AccountGuestMigrationMode;
}

function parseCommit(raw: Record<string, unknown>): AccountGuestMigrationInput {
  return {
    requestId: string(raw.requestId, 'requestId'),
    expectedRevision: integer(raw.expectedRevision, 'expectedRevision'),
    sourceHash: string(raw.sourceHash, 'sourceHash', 128),
    mode: parseMode(raw.mode),
    guest: raw.guest as AccountGuestMigrationInput['guest'],
    ...(raw.confirmation === undefined ? {} : { confirmation: string(raw.confirmation, 'confirmation', 64) }),
  };
}

function errorResult(error: unknown): GuestMigrationHttpResult {
  if (error instanceof MigrationRequestError) return { status: 400, body: { error: 'invalid_request', message: error.message } };
  const message = error instanceof Error ? error.message : 'unknown guest migration error';
  if (message.includes('idempotency key reused with different input')) return { status: 409, body: { error: 'idempotency_conflict' } };
  if (message.includes('source changed after preview')) return { status: 409, body: { error: 'migration_source_changed' } };
  if (message.includes('replacement requires explicit confirmation')) return { status: 400, body: { error: 'replacement_confirmation_required' } };
  if (message.includes('unknown guest migration')) return { status: 404, body: { error: 'migration_not_found' } };
  if (message.includes('stored guest migration') || message.includes('batch did not commit') || message.includes('committed without expected') || message.startsWith('D1_')) {
    return { status: 500, body: { error: 'migration_state_failure' } };
  }
  return { status: 400, body: { error: 'invalid_migration', message } };
}

export async function resolveGuestMigrationHttp(
  request: Request,
  db: D1Database,
  nowMs = Date.now(),
): Promise<GuestMigrationHttpResult | null> {
  const url = new URL(request.url);
  if (!MIGRATION_PATHS.has(url.pathname)) return null;
  if (request.method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' }, headers: { allow: 'POST' } };

  const principal = await resolveAuthSession(db, request.headers.get('authorization'), nowMs);
  if (!principal) return { status: 401, body: { error: 'authentication_required' }, headers: { 'www-authenticate': 'Bearer' } };

  try {
    const raw = await readBody(request);
    if (url.pathname === '/api/account/migration/preview') {
      return { status: 200, body: await previewGuestAccountMigration(db, principal.userId, raw.guest, nowMs) };
    }

    if (url.pathname === '/api/account/migration/commit') {
      const result = await applyGuestAccountMigration(db, principal.userId, parseCommit(raw), nowMs);
      if (!result.ok) {
        return {
          status: 409,
          body: {
            error: result.reason === 'server_not_empty' ? 'server_progress_conflict' : 'revision_conflict',
            currentRevision: result.currentRevision,
          },
        };
      }
      return {
        status: 200,
        body: {
          replayed: result.replayed,
          revision: result.record.revision,
          schemaVersion: result.record.snapshot.schemaVersion,
          snapshot: result.record.snapshot,
          profileRevision: result.profile.revision,
          result: result.result,
        },
      };
    }

    const migrationId = string(raw.migrationId, 'migrationId');
    const expectedRevision = integer(raw.expectedRevision, 'expectedRevision');
    const result = await rollbackGuestAccountMigration(db, principal.userId, migrationId, expectedRevision, nowMs);
    if (!result.ok) {
      return {
        status: 409,
        body: {
          error: result.reason,
          currentRevision: result.currentRevision,
        },
      };
    }
    return {
      status: 200,
      body: {
        replayed: result.replayed,
        revision: result.record.revision,
        schemaVersion: result.record.snapshot.schemaVersion,
        snapshot: result.record.snapshot,
        profileRevision: result.profile.revision,
        migrationId: result.migrationId,
      },
    };
  } catch (error) {
    return errorResult(error);
  }
}

export const __guestMigrationHttpTestOnly = { parseCommit, parseMode };
