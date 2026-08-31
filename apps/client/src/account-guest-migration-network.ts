import type { ProfileLoadout } from '@frontline/sim/achievement-profile';
import type { GuestProgress } from './save.ts';
import {
  getAccountClientState,
  refreshAuthenticatedAccount,
} from './account-network.ts';
import { clearAccountProfileNetworkState } from './account-profile-network.ts';
import { resolveCoopApiOrigin } from './coop-network.ts';

export type AccountGuestMigrationMode = 'IMPORT_IF_EMPTY' | 'REPLACE_EXISTING';
export const GUEST_REPLACE_CONFIRMATION = 'REPLACE_SERVER_PROGRESS' as const;

export interface GuestMigrationEnvelopeClient {
  readonly schemaVersion: 15;
  readonly capturedAtMs: number;
  readonly snapshot: GuestProgress;
  readonly profileLoadout?: ProfileLoadout;
}

export interface AccountProgressSummaryClient {
  readonly highestMainStageId: string | null;
  readonly mainClearCount: number;
  readonly specialClearCount: number;
  readonly ownedCharacterCount: number;
  readonly discoveredEnemyCount: number;
  readonly resourceBalances: Readonly<Record<string, number>>;
  readonly endlessBestReachedMinute: number;
  readonly bossRushBestDefeated: number;
}

export interface AccountGuestMigrationPreviewClient {
  readonly sourceHash: string;
  readonly capturedAtMs: number;
  readonly serverEmpty: boolean;
  readonly accountRevision: number;
  readonly profileRevision: number;
  readonly guest: AccountProgressSummaryClient;
  readonly server: AccountProgressSummaryClient;
  readonly recommendedMode: AccountGuestMigrationMode;
}

export interface AccountGuestMigrationCommitClient {
  readonly replayed: boolean;
  readonly revision: number;
  readonly profileRevision: number;
  readonly migrationId: string;
  readonly sourceHash: string;
  readonly mode: AccountGuestMigrationMode;
  readonly rollbackAvailable: boolean;
}

export interface AccountGuestMigrationRollbackClient {
  readonly replayed: boolean;
  readonly revision: number;
  readonly profileRevision: number;
  readonly migrationId: string;
}

export interface LocalGuestMigrationMarker {
  readonly migrationId: string;
  readonly sourceHash: string;
  readonly migratedAtMs: number;
}

const SESSION_TOKEN_KEY = 'frontline.account.sessionToken.v1';
const GUEST_MIGRATION_MARKER_KEY = 'frontline.guest.migratedToAccount.v1';
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = window.sessionStorage.getItem(SESSION_TOKEN_KEY);
    return token && SESSION_TOKEN_PATTERN.test(token) ? token : null;
  } catch {
    return null;
  }
}

export function getLocalGuestMigrationMarker(): LocalGuestMigrationMarker | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(GUEST_MIGRATION_MARKER_KEY) ?? 'null');
    if (!isRecord(raw)) return null;
    const migrationId = nonEmptyString(raw.migrationId);
    const sourceHash = nonEmptyString(raw.sourceHash);
    const migratedAtMs = nonNegativeInteger(raw.migratedAtMs);
    return migrationId && sourceHash && migratedAtMs !== null ? { migrationId, sourceHash, migratedAtMs } : null;
  } catch {
    return null;
  }
}

function writeLocalGuestMigrationMarker(marker: LocalGuestMigrationMarker): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(GUEST_MIGRATION_MARKER_KEY, JSON.stringify(marker)); } catch { /* marker is best-effort */ }
}

function clearLocalGuestMigrationMarker(migrationId: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (getLocalGuestMigrationMarker()?.migrationId === migrationId) window.localStorage.removeItem(GUEST_MIGRATION_MARKER_KEY);
  } catch { /* marker is best-effort */ }
}

function parseSummary(value: unknown): AccountProgressSummaryClient | null {
  if (!isRecord(value)) return null;
  const mainClearCount = nonNegativeInteger(value.mainClearCount);
  const specialClearCount = nonNegativeInteger(value.specialClearCount);
  const ownedCharacterCount = nonNegativeInteger(value.ownedCharacterCount);
  const discoveredEnemyCount = nonNegativeInteger(value.discoveredEnemyCount);
  const endlessBestReachedMinute = nonNegativeInteger(value.endlessBestReachedMinute);
  const bossRushBestDefeated = nonNegativeInteger(value.bossRushBestDefeated);
  const highestMainStageId = value.highestMainStageId === null ? null : nonEmptyString(value.highestMainStageId);
  if (
    mainClearCount === null || specialClearCount === null || ownedCharacterCount === null || discoveredEnemyCount === null
    || endlessBestReachedMinute === null || bossRushBestDefeated === null || !isRecord(value.resourceBalances)
    || (value.highestMainStageId !== null && highestMainStageId === null)
  ) return null;
  const resourceBalances: Record<string, number> = {};
  for (const [id, raw] of Object.entries(value.resourceBalances)) {
    const amount = nonNegativeInteger(raw);
    if (amount === null) return null;
    resourceBalances[id] = amount;
  }
  return {
    highestMainStageId,
    mainClearCount,
    specialClearCount,
    ownedCharacterCount,
    discoveredEnemyCount,
    resourceBalances,
    endlessBestReachedMinute,
    bossRushBestDefeated,
  };
}

export function parseGuestMigrationPreview(value: unknown): AccountGuestMigrationPreviewClient | null {
  if (!isRecord(value)) return null;
  const sourceHash = nonEmptyString(value.sourceHash);
  const capturedAtMs = nonNegativeInteger(value.capturedAtMs);
  const accountRevision = nonNegativeInteger(value.accountRevision);
  const profileRevision = nonNegativeInteger(value.profileRevision);
  const guest = parseSummary(value.guest);
  const server = parseSummary(value.server);
  const mode = value.recommendedMode === 'IMPORT_IF_EMPTY' || value.recommendedMode === 'REPLACE_EXISTING' ? value.recommendedMode : null;
  if (!sourceHash || capturedAtMs === null || accountRevision === null || profileRevision === null || !guest || !server || !mode || typeof value.serverEmpty !== 'boolean') return null;
  return { sourceHash, capturedAtMs, serverEmpty: value.serverEmpty, accountRevision, profileRevision, guest, server, recommendedMode: mode };
}

function parseCommit(value: unknown): AccountGuestMigrationCommitClient | null {
  if (!isRecord(value) || typeof value.replayed !== 'boolean' || !isRecord(value.result)) return null;
  const revision = nonNegativeInteger(value.revision);
  const profileRevision = nonNegativeInteger(value.profileRevision);
  const migrationId = nonEmptyString(value.result.migrationId);
  const sourceHash = nonEmptyString(value.result.sourceHash);
  const mode = value.result.mode === 'IMPORT_IF_EMPTY' || value.result.mode === 'REPLACE_EXISTING' ? value.result.mode : null;
  if (revision === null || profileRevision === null || !migrationId || !sourceHash || !mode || typeof value.result.rollbackAvailable !== 'boolean') return null;
  return { replayed: value.replayed, revision, profileRevision, migrationId, sourceHash, mode, rollbackAvailable: value.result.rollbackAvailable };
}

function parseRollback(value: unknown): AccountGuestMigrationRollbackClient | null {
  if (!isRecord(value) || typeof value.replayed !== 'boolean') return null;
  const revision = nonNegativeInteger(value.revision);
  const profileRevision = nonNegativeInteger(value.profileRevision);
  const migrationId = nonEmptyString(value.migrationId);
  return revision === null || profileRevision === null || !migrationId ? null : { replayed: value.replayed, revision, profileRevision, migrationId };
}

export class GuestMigrationApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly currentRevision: number | null = null) {
    super(`guest migration api error:${status}:${code}`);
  }
}

async function request(path: string, body: Readonly<Record<string, unknown>>): Promise<unknown> {
  const token = readToken();
  if (!token) throw new Error('authenticated account session is not available');
  const response = await fetch(`${resolveCoopApiOrigin()}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'http_error';
    const currentRevision = isRecord(payload) ? nonNegativeInteger(payload.currentRevision) : null;
    throw new GuestMigrationApiError(response.status, code, currentRevision);
  }
  return payload;
}

function requireOnlineRevision(): number {
  const state = getAccountClientState();
  if (state.kind !== 'AUTHENTICATED_ONLINE') throw new Error('guest migration requires AUTHENTICATED_ONLINE state');
  return state.remote.revision;
}

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `guest-migration-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function captureGuestMigrationEnvelope(progress: GuestProgress, profileLoadout?: ProfileLoadout, nowMs = Date.now()): GuestMigrationEnvelopeClient {
  return {
    schemaVersion: 15,
    capturedAtMs: nowMs,
    snapshot: progress,
    ...(profileLoadout === undefined ? {} : { profileLoadout }),
  };
}

export async function previewAuthenticatedGuestMigration(guest: GuestMigrationEnvelopeClient): Promise<AccountGuestMigrationPreviewClient> {
  requireOnlineRevision();
  const payload = await request('/api/account/migration/preview', { guest });
  const preview = parseGuestMigrationPreview(payload);
  if (!preview) throw new Error('guest migration preview response shape is invalid');
  return preview;
}

export async function commitAuthenticatedGuestMigration(
  guest: GuestMigrationEnvelopeClient,
  preview: AccountGuestMigrationPreviewClient,
  mode: AccountGuestMigrationMode,
  confirmation?: string,
): Promise<AccountGuestMigrationCommitClient> {
  const expectedRevision = requireOnlineRevision();
  if (expectedRevision !== preview.accountRevision) throw new GuestMigrationApiError(409, 'local_revision_changed', expectedRevision);
  const payload = await request('/api/account/migration/commit', {
    requestId: newRequestId(),
    expectedRevision,
    sourceHash: preview.sourceHash,
    mode,
    guest,
    ...(confirmation === undefined ? {} : { confirmation }),
  });
  const result = parseCommit(payload);
  if (!result) throw new Error('guest migration commit response shape is invalid');
  writeLocalGuestMigrationMarker({ migrationId: result.migrationId, sourceHash: result.sourceHash, migratedAtMs: Date.now() });
  clearAccountProfileNetworkState();
  await refreshAuthenticatedAccount();
  return result;
}

export async function rollbackAuthenticatedGuestMigration(migrationId: string): Promise<AccountGuestMigrationRollbackClient> {
  const expectedRevision = requireOnlineRevision();
  const payload = await request('/api/account/migration/rollback', { migrationId, expectedRevision });
  const result = parseRollback(payload);
  if (!result) throw new Error('guest migration rollback response shape is invalid');
  clearLocalGuestMigrationMarker(migrationId);
  clearAccountProfileNetworkState();
  await refreshAuthenticatedAccount();
  return result;
}

export const __guestMigrationNetworkTestOnly = {
  parseSummary,
  parseGuestMigrationPreview,
  parseCommit,
  parseRollback,
  SESSION_TOKEN_KEY,
  GUEST_MIGRATION_MARKER_KEY,
};
