import type { ProfileLoadout } from '@frontline/sim/achievement-profile';
import {
  META_RESOURCE_IDS,
  getResourceBalance,
  type ResourceAmounts,
} from '@frontline/sim/resource-ledger';
import {
  createInitialAccountSave,
  initializeAccountSave,
  loadAccountSave,
  normalizeAccountSaveSnapshot,
  type AccountSaveRecord,
  type AccountSaveSnapshotV2,
} from './account-save-authority.ts';
import {
  ACCOUNT_PROFILE_SCHEMA_VERSION,
  initializeAccountProfile,
  normalizeAccountProfileSnapshot,
  type AccountProfileRecord,
  type AccountProfileSnapshotV1,
} from './account-profile-authority.ts';
import { getAccountOwnedCharacterIds } from './progression-authority.ts';

export const GUEST_IMPORT_SCHEMA_VERSION = 15;
export const ACCOUNT_GUEST_MIGRATION_MODES = ['IMPORT_IF_EMPTY', 'REPLACE_EXISTING'] as const;
export type AccountGuestMigrationMode = (typeof ACCOUNT_GUEST_MIGRATION_MODES)[number];
export const ACCOUNT_GUEST_REPLACE_CONFIRMATION = 'REPLACE_SERVER_PROGRESS' as const;

export interface GuestMigrationEnvelope {
  readonly schemaVersion: 15;
  readonly capturedAtMs: number;
  readonly snapshot: unknown;
  readonly profileLoadout?: ProfileLoadout;
}

export interface AccountProgressSummary {
  readonly highestMainStageId: string | null;
  readonly mainClearCount: number;
  readonly specialClearCount: number;
  readonly ownedCharacterCount: number;
  readonly discoveredEnemyCount: number;
  readonly resourceBalances: ResourceAmounts;
  readonly endlessBestReachedMinute: number;
  readonly bossRushBestDefeated: number;
}

export interface AccountGuestMigrationPreview {
  readonly sourceHash: string;
  readonly capturedAtMs: number;
  readonly serverEmpty: boolean;
  readonly accountRevision: number;
  readonly profileRevision: number;
  readonly guest: AccountProgressSummary;
  readonly server: AccountProgressSummary;
  readonly recommendedMode: AccountGuestMigrationMode;
}

export interface AccountGuestMigrationInput {
  readonly requestId: string;
  readonly expectedRevision: number;
  readonly sourceHash: string;
  readonly mode: AccountGuestMigrationMode;
  readonly guest: GuestMigrationEnvelope;
  readonly confirmation?: string;
}

export interface AccountGuestMigrationResult {
  readonly migrationId: string;
  readonly sourceHash: string;
  readonly mode: AccountGuestMigrationMode;
  readonly previousRevision: number;
  readonly importedRevision: number;
  readonly previousProfileRevision: number;
  readonly importedProfileRevision: number;
  readonly rollbackAvailable: boolean;
  readonly guest: AccountProgressSummary;
}

export type AccountGuestMigrationApplyResult =
  | {
      readonly ok: true;
      readonly replayed: boolean;
      readonly record: AccountSaveRecord;
      readonly profile: AccountProfileRecord;
      readonly result: AccountGuestMigrationResult;
    }
  | {
      readonly ok: false;
      readonly reason: 'revision_conflict' | 'server_not_empty';
      readonly currentRevision: number;
    };

export type AccountGuestMigrationRollbackResult =
  | {
      readonly ok: true;
      readonly replayed: boolean;
      readonly record: AccountSaveRecord;
      readonly profile: AccountProfileRecord;
      readonly migrationId: string;
    }
  | {
      readonly ok: false;
      readonly reason: 'revision_conflict' | 'rollback_unavailable';
      readonly currentRevision: number;
    };

type MigrationRow = {
  readonly source_hash: string;
  readonly mode: AccountGuestMigrationMode;
  readonly previous_revision: number;
  readonly previous_snapshot_json: string;
  readonly previous_profile_revision: number;
  readonly previous_profile_snapshot_json: string;
  readonly imported_revision: number;
  readonly imported_profile_revision: number;
  readonly result_json: string;
  readonly restored_at: number | null;
  readonly restored_revision: number | null;
  readonly restored_profile_revision: number | null;
};

function object(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
}

function nonEmptyId(value: string, context: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 128) throw new Error(`${context} must be 1..128 characters`);
  return trimmed;
}

function nonNegativeInteger(value: unknown, context: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${context} must be a non-negative integer`);
  return value as number;
}

function normalizeMode(value: unknown): AccountGuestMigrationMode {
  if (value === 'IMPORT_IF_EMPTY' || value === 'REPLACE_EXISTING') return value;
  throw new Error('guest migration mode is unknown');
}

function guestEnvelope(value: unknown): GuestMigrationEnvelope {
  const raw = object(value, 'guest migration envelope');
  if (raw.schemaVersion !== GUEST_IMPORT_SCHEMA_VERSION) throw new Error(`unsupported guest migration schema:${String(raw.schemaVersion)}`);
  const capturedAtMs = nonNegativeInteger(raw.capturedAtMs, 'guest capturedAtMs');
  return {
    schemaVersion: GUEST_IMPORT_SCHEMA_VERSION,
    capturedAtMs,
    snapshot: raw.snapshot,
    ...(raw.profileLoadout === undefined ? {} : { profileLoadout: raw.profileLoadout as ProfileLoadout }),
  };
}

export function mapGuestProgressToAccountSave(value: unknown, nowMs = Date.now()): AccountSaveSnapshotV2 {
  const raw = object(value, 'guest progress snapshot');
  return normalizeAccountSaveSnapshot({
    schemaVersion: 2,
    clearedStageIds: raw.clearedStageIds,
    normalClearSourceByStage: raw.normalClearSourceByStage ?? {},
    mainRewardedStageIds: raw.mainRewardedStageIds ?? [],
    specialClearedStageIds: raw.specialClearedStageIds,
    permanentRewardIds: raw.permanentRewardIds,
    discoveredEnemyIds: raw.discoveredEnemyIds ?? [],
    ownedRecruitmentCharacterIds: raw.ownedRecruitmentCharacterIds ?? [],
    characterProgressById: raw.characterProgressById ?? {},
    deckSlotIds: Array.isArray(raw.deckSlotIds) && raw.deckSlotIds.length > 0 ? raw.deckSlotIds : ['militia'],
    selectedBaseWeaponId: raw.selectedBaseWeaponId ?? 'base_weapon_front_cannon',
    resourceLedgerById: raw.resourceLedgerById ?? {},
    periodicRewardChargeByCollection: raw.periodicRewardChargeByCollection,
    recordModeProgress: raw.recordModeProgress,
  }, nowMs);
}

export function summarizeAccountProgress(snapshot: AccountSaveSnapshotV2): AccountProgressSummary {
  const resourceBalances: Record<string, number> = {};
  for (const resourceId of META_RESOURCE_IDS) {
    const balance = getResourceBalance(snapshot.resourceLedgerById, resourceId);
    if (balance !== 0) resourceBalances[resourceId] = balance;
  }
  return {
    highestMainStageId: snapshot.clearedStageIds.at(-1) ?? null,
    mainClearCount: snapshot.clearedStageIds.length,
    specialClearCount: snapshot.specialClearedStageIds.length,
    ownedCharacterCount: getAccountOwnedCharacterIds(snapshot).length,
    discoveredEnemyCount: snapshot.discoveredEnemyIds.length,
    resourceBalances,
    endlessBestReachedMinute: snapshot.recordModeProgress.endlessBestReachedMinute,
    bossRushBestDefeated: snapshot.recordModeProgress.bossRushBestDefeated,
  };
}

export function isPristineAccountSave(record: AccountSaveRecord): boolean {
  return record.revision === 0 && JSON.stringify(record.snapshot) === JSON.stringify(createInitialAccountSave());
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function normalizeGuestSource(value: unknown, nowMs: number): Promise<{
  envelope: GuestMigrationEnvelope;
  snapshot: AccountSaveSnapshotV2;
  sourceHash: string;
}> {
  const envelope = guestEnvelope(value);
  const snapshot = mapGuestProgressToAccountSave(envelope.snapshot, nowMs);
  const sourceHash = await sha256Hex(JSON.stringify({
    schemaVersion: envelope.schemaVersion,
    capturedAtMs: envelope.capturedAtMs,
    snapshot,
    profileLoadout: envelope.profileLoadout ?? null,
  }));
  return { envelope, snapshot, sourceHash };
}

export async function previewGuestAccountMigration(
  db: D1Database,
  rawAccountId: string,
  guestValue: unknown,
  nowMs = Date.now(),
): Promise<AccountGuestMigrationPreview> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  const source = await normalizeGuestSource(guestValue, nowMs);
  const current = await initializeAccountSave(db, accountId, undefined, nowMs);
  const profile = await initializeAccountProfile(db, accountId, nowMs);
  const serverEmpty = isPristineAccountSave(current);
  return {
    sourceHash: source.sourceHash,
    capturedAtMs: source.envelope.capturedAtMs,
    serverEmpty,
    accountRevision: current.revision,
    profileRevision: profile.revision,
    guest: summarizeAccountProgress(source.snapshot),
    server: summarizeAccountProgress(current.snapshot),
    recommendedMode: serverEmpty ? 'IMPORT_IF_EMPTY' : 'REPLACE_EXISTING',
  };
}

async function loadMigration(db: D1Database, accountId: string, migrationId: string): Promise<MigrationRow | null> {
  return db.prepare(
    `SELECT source_hash, mode, previous_revision, previous_snapshot_json,
            previous_profile_revision, previous_profile_snapshot_json,
            imported_revision, imported_profile_revision, result_json,
            restored_at, restored_revision, restored_profile_revision
     FROM account_guest_migrations
     WHERE user_id = ?1 AND migration_id = ?2`,
  ).bind(accountId, migrationId).first<MigrationRow>();
}

function parseMigrationResult(row: MigrationRow): AccountGuestMigrationResult {
  try { return JSON.parse(row.result_json) as AccountGuestMigrationResult; }
  catch { throw new Error('stored guest migration result JSON is invalid'); }
}

async function currentRecords(db: D1Database, accountId: string, nowMs: number): Promise<{ save: AccountSaveRecord; profile: AccountProfileRecord }> {
  const save = await initializeAccountSave(db, accountId, undefined, nowMs);
  const profile = await initializeAccountProfile(db, accountId, nowMs);
  return { save, profile };
}

async function resolveReplay(
  db: D1Database,
  accountId: string,
  migrationId: string,
  sourceHash: string,
  mode: AccountGuestMigrationMode,
  nowMs: number,
): Promise<AccountGuestMigrationApplyResult | null> {
  const row = await loadMigration(db, accountId, migrationId);
  if (!row) return null;
  if (row.source_hash !== sourceHash || row.mode !== mode) throw new Error(`idempotency key reused with different input:GUEST_MIGRATION:${migrationId}`);
  const current = await currentRecords(db, accountId, nowMs);
  if (current.save.revision < row.imported_revision || current.profile.revision < row.imported_profile_revision) {
    throw new Error(`account revision is behind guest migration receipt:${migrationId}`);
  }
  return { ok: true, replayed: true, record: current.save, profile: current.profile, result: parseMigrationResult(row) };
}

export async function applyGuestAccountMigration(
  db: D1Database,
  rawAccountId: string,
  input: AccountGuestMigrationInput,
  nowMs = Date.now(),
): Promise<AccountGuestMigrationApplyResult> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  const requestId = nonEmptyId(input.requestId, 'requestId');
  const expectedRevision = nonNegativeInteger(input.expectedRevision, 'expectedRevision');
  const mode = normalizeMode(input.mode);
  const source = await normalizeGuestSource(input.guest, nowMs);
  if (source.sourceHash !== input.sourceHash) throw new Error('guest migration source changed after preview');

  const replay = await resolveReplay(db, accountId, requestId, source.sourceHash, mode, nowMs);
  if (replay) return replay;

  const current = await initializeAccountSave(db, accountId, undefined, nowMs);
  const currentProfile = await initializeAccountProfile(db, accountId, nowMs);
  if (current.revision !== expectedRevision) return { ok: false, reason: 'revision_conflict', currentRevision: current.revision };
  const serverEmpty = isPristineAccountSave(current);
  if (mode === 'IMPORT_IF_EMPTY' && !serverEmpty) return { ok: false, reason: 'server_not_empty', currentRevision: current.revision };
  if (mode === 'REPLACE_EXISTING' && !serverEmpty && input.confirmation !== ACCOUNT_GUEST_REPLACE_CONFIRMATION) {
    throw new Error('guest migration replacement requires explicit confirmation');
  }

  const importedProfile = normalizeAccountProfileSnapshot({
    ...currentProfile.snapshot,
    profileLoadout: source.envelope.profileLoadout ?? currentProfile.snapshot.profileLoadout,
  }, source.snapshot).snapshot;
  const importedRevision = expectedRevision + 1;
  const importedProfileRevision = currentProfile.revision + 1;
  const result: AccountGuestMigrationResult = {
    migrationId: requestId,
    sourceHash: source.sourceHash,
    mode,
    previousRevision: current.revision,
    importedRevision,
    previousProfileRevision: currentProfile.revision,
    importedProfileRevision,
    rollbackAvailable: true,
    guest: summarizeAccountProgress(source.snapshot),
  };

  try {
    const writes = await db.batch([
      db.prepare(
        `UPDATE account_saves
         SET schema_version = 2,
             revision = CASE WHEN revision = ?4 THEN revision + 1 ELSE -1 END,
             snapshot_json = ?1,
             updated_at = unixepoch()
         WHERE user_id = ?2`,
      ).bind(JSON.stringify(source.snapshot), accountId, 2, expectedRevision),
      db.prepare(
        `UPDATE account_profiles
         SET schema_version = ?1,
             revision = CASE WHEN revision = ?5 THEN revision + 1 ELSE -1 END,
             snapshot_json = ?2,
             updated_at = unixepoch()
         WHERE user_id = ?3`,
      ).bind(ACCOUNT_PROFILE_SCHEMA_VERSION, JSON.stringify(importedProfile), accountId, ACCOUNT_PROFILE_SCHEMA_VERSION, currentProfile.revision),
      db.prepare(
        `INSERT INTO account_guest_migrations
         (user_id, migration_id, source_hash, mode,
          previous_revision, previous_snapshot_json,
          previous_profile_revision, previous_profile_snapshot_json,
          imported_revision, imported_profile_revision, result_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      ).bind(
        accountId,
        requestId,
        source.sourceHash,
        mode,
        current.revision,
        JSON.stringify(current.snapshot),
        currentProfile.revision,
        JSON.stringify(currentProfile.snapshot),
        importedRevision,
        importedProfileRevision,
        JSON.stringify(result),
      ),
    ]);
    if (writes.length !== 3 || writes.some((write) => (write.meta.changes ?? 0) !== 1)) {
      throw new Error(`guest migration batch did not commit all rows:${requestId}`);
    }
  } catch (error) {
    const racedReplay = await resolveReplay(db, accountId, requestId, source.sourceHash, mode, nowMs);
    if (racedReplay) return racedReplay;
    const latest = await loadAccountSave(db, accountId, nowMs);
    if (latest && latest.revision !== expectedRevision) return { ok: false, reason: 'revision_conflict', currentRevision: latest.revision };
    throw error;
  }

  const committed = await currentRecords(db, accountId, nowMs);
  if (committed.save.revision !== importedRevision || committed.profile.revision !== importedProfileRevision) {
    throw new Error(`guest migration committed without expected revisions:${requestId}`);
  }
  return { ok: true, replayed: false, record: committed.save, profile: committed.profile, result };
}

function decodePreviousSave(row: MigrationRow, nowMs: number): AccountSaveSnapshotV2 {
  try { return normalizeAccountSaveSnapshot(JSON.parse(row.previous_snapshot_json) as unknown, nowMs); }
  catch { throw new Error('stored guest migration previous save JSON is invalid'); }
}

function decodePreviousProfile(row: MigrationRow, save: AccountSaveSnapshotV2): AccountProfileSnapshotV1 {
  try { return normalizeAccountProfileSnapshot(JSON.parse(row.previous_profile_snapshot_json) as unknown, save).snapshot; }
  catch { throw new Error('stored guest migration previous profile JSON is invalid'); }
}

export async function rollbackGuestAccountMigration(
  db: D1Database,
  rawAccountId: string,
  rawMigrationId: string,
  expectedRevision: number,
  nowMs = Date.now(),
): Promise<AccountGuestMigrationRollbackResult> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  const migrationId = nonEmptyId(rawMigrationId, 'migrationId');
  const expected = nonNegativeInteger(expectedRevision, 'expectedRevision');
  const row = await loadMigration(db, accountId, migrationId);
  if (!row) throw new Error(`unknown guest migration:${migrationId}`);
  const current = await currentRecords(db, accountId, nowMs);
  if (row.restored_at !== null) return { ok: true, replayed: true, record: current.save, profile: current.profile, migrationId };
  if (current.save.revision !== expected) return { ok: false, reason: 'revision_conflict', currentRevision: current.save.revision };
  if (current.save.revision !== row.imported_revision || current.profile.revision !== row.imported_profile_revision) {
    return { ok: false, reason: 'rollback_unavailable', currentRevision: current.save.revision };
  }

  const previousSave = decodePreviousSave(row, nowMs);
  const previousProfile = decodePreviousProfile(row, previousSave);
  const restoredRevision = current.save.revision + 1;
  const restoredProfileRevision = current.profile.revision + 1;
  try {
    const writes = await db.batch([
      db.prepare(
        `UPDATE account_saves
         SET schema_version = 2,
             revision = CASE WHEN revision = ?4 THEN revision + 1 ELSE -1 END,
             snapshot_json = ?1,
             updated_at = unixepoch()
         WHERE user_id = ?2`,
      ).bind(JSON.stringify(previousSave), accountId, 2, current.save.revision),
      db.prepare(
        `UPDATE account_profiles
         SET schema_version = ?1,
             revision = CASE WHEN revision = ?5 THEN revision + 1 ELSE -1 END,
             snapshot_json = ?2,
             updated_at = unixepoch()
         WHERE user_id = ?3`,
      ).bind(ACCOUNT_PROFILE_SCHEMA_VERSION, JSON.stringify(previousProfile), accountId, ACCOUNT_PROFILE_SCHEMA_VERSION, current.profile.revision),
      db.prepare(
        `UPDATE account_guest_migrations
         SET restored_at = unixepoch(), restored_revision = ?1, restored_profile_revision = ?2
         WHERE user_id = ?3 AND migration_id = ?4 AND restored_at IS NULL`,
      ).bind(restoredRevision, restoredProfileRevision, accountId, migrationId),
    ]);
    if (writes.length !== 3 || writes.some((write) => (write.meta.changes ?? 0) !== 1)) {
      throw new Error(`guest migration rollback batch did not commit all rows:${migrationId}`);
    }
  } catch (error) {
    const latestRow = await loadMigration(db, accountId, migrationId);
    const latest = await currentRecords(db, accountId, nowMs);
    if (latestRow?.restored_at !== null && latestRow?.restored_at !== undefined) {
      return { ok: true, replayed: true, record: latest.save, profile: latest.profile, migrationId };
    }
    if (latest.save.revision !== current.save.revision) return { ok: false, reason: 'revision_conflict', currentRevision: latest.save.revision };
    throw error;
  }

  const restored = await currentRecords(db, accountId, nowMs);
  if (restored.save.revision !== restoredRevision || restored.profile.revision !== restoredProfileRevision) {
    throw new Error(`guest migration rollback committed without expected revisions:${migrationId}`);
  }
  return { ok: true, replayed: false, record: restored.save, profile: restored.profile, migrationId };
}

export const __accountGuestMigrationTestOnly = {
  guestEnvelope,
  mapGuestProgressToAccountSave,
  summarizeAccountProgress,
  isPristineAccountSave,
};
