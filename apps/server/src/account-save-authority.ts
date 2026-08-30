import { BASE_WEAPON_IDS, type BaseWeaponId } from '@frontline/sim/playable';
import {
  META_RESOURCE_IDS,
  normalizeResourceLedger,
  type ResourceLedger,
} from '@frontline/sim/resource-ledger';
import {
  PERIODIC_REWARD_CHARGE_MAX,
  PERIODIC_REWARD_COLLECTION_IDS,
  createFullPeriodicRewardChargeMap,
  normalizePeriodicRewardChargeMap,
  type PeriodicRewardChargeMap,
} from '@frontline/sim/periodic-special';
import {
  createInitialAccountProgression,
  loadAccountProgression,
  normalizeAccountProgressionSnapshot,
  type AccountCharacterProgress,
  type AccountNormalClearSource,
  type AccountProgressionSnapshotV1,
} from './progression-authority.ts';
import { isServerCoopBaseWeaponUnlocked } from './runtime-content.ts';

export const ACCOUNT_SAVE_SCHEMA_VERSION = 2;
export const ACCOUNT_BOSS_RUSH_MAX_DEFEATED = 9;

export interface AccountRecordModeProgress {
  readonly endlessBestTimeMs: number;
  readonly endlessBestReachedMinute: number;
  readonly endlessRewardedMinute: number;
  readonly bossRushBestDefeated: number;
  readonly bossRushRewardedDefeated: number;
}

export interface AccountSaveSnapshotV2 {
  readonly schemaVersion: 2;
  readonly clearedStageIds: readonly string[];
  readonly normalClearSourceByStage: Readonly<Record<string, AccountNormalClearSource>>;
  readonly mainRewardedStageIds: readonly string[];
  readonly specialClearedStageIds: readonly string[];
  readonly permanentRewardIds: readonly string[];
  readonly discoveredEnemyIds: readonly string[];
  readonly ownedRecruitmentCharacterIds: readonly string[];
  readonly characterProgressById: Readonly<Record<string, AccountCharacterProgress>>;
  readonly deckSlotIds: readonly string[];
  readonly selectedBaseWeaponId: BaseWeaponId;
  readonly resourceLedgerById: ResourceLedger;
  readonly periodicRewardChargeByCollection: PeriodicRewardChargeMap;
  readonly recordModeProgress: AccountRecordModeProgress;
}

export interface AccountSaveRecord {
  readonly accountId: string;
  readonly revision: number;
  readonly snapshot: AccountSaveSnapshotV2;
  readonly updatedAt: number;
}

export type ReplaceAccountSaveResult =
  | { readonly ok: true; readonly record: AccountSaveRecord }
  | { readonly ok: false; readonly reason: 'revision_conflict'; readonly currentRevision: number };

const RESOURCE_ID_SET = new Set<string>(META_RESOURCE_IDS);
const PERIODIC_COLLECTION_ID_SET = new Set<string>(PERIODIC_REWARD_COLLECTION_IDS);
const BASE_WEAPON_ID_SET = new Set<string>(BASE_WEAPON_IDS);
const DEFAULT_RECORD_PROGRESS: AccountRecordModeProgress = {
  endlessBestTimeMs: 0,
  endlessBestReachedMinute: 0,
  endlessRewardedMinute: 0,
  bossRushBestDefeated: 0,
  bossRushRewardedDefeated: 0,
};

function object(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
}

function nonNegativeInteger(value: unknown, context: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${context} must be a non-negative integer`);
  return value as number;
}

function accountId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 128) throw new Error('accountId must be 1..128 characters');
  return trimmed;
}

function normalizeMainRewardedStageIds(value: unknown, clearedStageIds: readonly string[]): readonly string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string' && entry.length > 0)) {
    throw new Error('account save mainRewardedStageIds must be a string array');
  }
  if (new Set(value).size !== value.length) throw new Error('account save mainRewardedStageIds must not contain duplicates');
  const cleared = new Set(clearedStageIds);
  for (const stageId of value) {
    if (!cleared.has(stageId)) throw new Error(`account save reward receipt references uncleared stage:${stageId}`);
  }
  return value as readonly string[];
}

function normalizeStrictResourceLedger(value: unknown): ResourceLedger {
  const raw = object(value, 'account save resourceLedgerById');
  for (const id of Object.keys(raw)) {
    if (!RESOURCE_ID_SET.has(id)) throw new Error(`unknown account meta resource:${id}`);
  }
  for (const id of META_RESOURCE_IDS) {
    const candidate = raw[id];
    if (candidate === undefined) continue;
    const entry = object(candidate, `account meta resource ${id}`);
    const earned = nonNegativeInteger(entry.earned, `${id}.earned`);
    const spent = nonNegativeInteger(entry.spent, `${id}.spent`);
    if (spent > earned) throw new Error(`account meta resource spent exceeds earned:${id}`);
  }
  return normalizeResourceLedger(raw);
}

function normalizeStrictPeriodicChargeMap(value: unknown, nowMs: number): PeriodicRewardChargeMap {
  const raw = object(value, 'account save periodicRewardChargeByCollection');
  for (const id of Object.keys(raw)) {
    if (!PERIODIC_COLLECTION_ID_SET.has(id)) throw new Error(`unknown account periodic collection:${id}`);
  }
  for (const id of PERIODIC_REWARD_COLLECTION_IDS) {
    if (!(id in raw)) throw new Error(`account periodic charge is missing collection:${id}`);
    const state = object(raw[id], `account periodic charge ${id}`);
    const charges = nonNegativeInteger(state.charges, `${id}.charges`);
    if (charges > PERIODIC_REWARD_CHARGE_MAX) throw new Error(`account periodic charge exceeds cap:${id}`);
    if (charges >= PERIODIC_REWARD_CHARGE_MAX) {
      if (state.nextChargeAtMs !== null) throw new Error(`capped account periodic charge must have null nextChargeAtMs:${id}`);
      continue;
    }
    if (!Number.isInteger(state.nextChargeAtMs) || (state.nextChargeAtMs as number) < 0) {
      throw new Error(`account periodic charge requires a non-negative nextChargeAtMs:${id}`);
    }
  }
  return normalizePeriodicRewardChargeMap(raw, nowMs);
}

function normalizeRecordModeProgress(value: unknown): AccountRecordModeProgress {
  const raw = object(value, 'account save recordModeProgress');
  const endlessBestTimeMs = nonNegativeInteger(raw.endlessBestTimeMs, 'endlessBestTimeMs');
  const endlessBestReachedMinute = nonNegativeInteger(raw.endlessBestReachedMinute, 'endlessBestReachedMinute');
  const endlessRewardedMinute = nonNegativeInteger(raw.endlessRewardedMinute, 'endlessRewardedMinute');
  const expectedReachedMinute = Math.floor(endlessBestTimeMs / 60_000);
  if (endlessBestReachedMinute !== expectedReachedMinute) {
    throw new Error('account endless reached minute must match best time');
  }
  if (endlessRewardedMinute > endlessBestReachedMinute) {
    throw new Error('account endless rewarded minute exceeds best reached minute');
  }
  const bossRushBestDefeated = nonNegativeInteger(raw.bossRushBestDefeated, 'bossRushBestDefeated');
  const bossRushRewardedDefeated = nonNegativeInteger(raw.bossRushRewardedDefeated, 'bossRushRewardedDefeated');
  if (bossRushBestDefeated > ACCOUNT_BOSS_RUSH_MAX_DEFEATED) {
    throw new Error('account boss rush best exceeds runtime boss count');
  }
  if (bossRushRewardedDefeated > bossRushBestDefeated) {
    throw new Error('account boss rush rewarded count exceeds best defeated');
  }
  return {
    endlessBestTimeMs,
    endlessBestReachedMinute,
    endlessRewardedMinute,
    bossRushBestDefeated,
    bossRushRewardedDefeated,
  };
}

function normalizeSelectedBaseWeaponId(value: unknown, clearedStageIds: readonly string[]): BaseWeaponId {
  if (typeof value !== 'string' || !BASE_WEAPON_ID_SET.has(value)) throw new Error(`unknown account base weapon:${String(value)}`);
  const baseWeaponId = value as BaseWeaponId;
  if (!isServerCoopBaseWeaponUnlocked(baseWeaponId, clearedStageIds)) throw new Error(`account base weapon is locked:${baseWeaponId}`);
  return baseWeaponId;
}

function progressionFields(snapshot: AccountProgressionSnapshotV1) {
  return {
    clearedStageIds: snapshot.clearedStageIds,
    normalClearSourceByStage: snapshot.normalClearSourceByStage,
    specialClearedStageIds: snapshot.specialClearedStageIds,
    permanentRewardIds: snapshot.permanentRewardIds,
    discoveredEnemyIds: snapshot.discoveredEnemyIds,
    ownedRecruitmentCharacterIds: snapshot.ownedRecruitmentCharacterIds,
    characterProgressById: snapshot.characterProgressById,
    deckSlotIds: snapshot.deckSlotIds,
  };
}

export function migrateAccountProgressionV1ToSaveV2(value: unknown): AccountSaveSnapshotV2 {
  const progression = normalizeAccountProgressionSnapshot(value);
  return {
    schemaVersion: ACCOUNT_SAVE_SCHEMA_VERSION,
    ...progressionFields(progression),
    // v1 never stored a wallet or first-clear receipt ledger. Conservatively mark already-cleared MAIN stages
    // as rewarded so enabling the v2 wallet cannot retroactively duplicate first-clear grants.
    mainRewardedStageIds: [...progression.clearedStageIds],
    selectedBaseWeaponId: 'base_weapon_front_cannon',
    resourceLedgerById: {},
    periodicRewardChargeByCollection: createFullPeriodicRewardChargeMap(),
    recordModeProgress: DEFAULT_RECORD_PROGRESS,
  };
}

export function normalizeAccountSaveSnapshot(value: unknown, nowMs = Date.now()): AccountSaveSnapshotV2 {
  const raw = object(value, 'account save snapshot');
  if (raw.schemaVersion === 1) return migrateAccountProgressionV1ToSaveV2(raw);
  if (raw.schemaVersion !== ACCOUNT_SAVE_SCHEMA_VERSION) {
    throw new Error(`unsupported account save schema:${String(raw.schemaVersion)}`);
  }

  const progression = normalizeAccountProgressionSnapshot({
    schemaVersion: 1,
    clearedStageIds: raw.clearedStageIds,
    normalClearSourceByStage: raw.normalClearSourceByStage,
    specialClearedStageIds: raw.specialClearedStageIds,
    permanentRewardIds: raw.permanentRewardIds,
    discoveredEnemyIds: raw.discoveredEnemyIds,
    ownedRecruitmentCharacterIds: raw.ownedRecruitmentCharacterIds,
    characterProgressById: raw.characterProgressById,
    deckSlotIds: raw.deckSlotIds,
  });

  return {
    schemaVersion: ACCOUNT_SAVE_SCHEMA_VERSION,
    ...progressionFields(progression),
    mainRewardedStageIds: normalizeMainRewardedStageIds(raw.mainRewardedStageIds, progression.clearedStageIds),
    selectedBaseWeaponId: normalizeSelectedBaseWeaponId(raw.selectedBaseWeaponId, progression.clearedStageIds),
    resourceLedgerById: normalizeStrictResourceLedger(raw.resourceLedgerById),
    periodicRewardChargeByCollection: normalizeStrictPeriodicChargeMap(raw.periodicRewardChargeByCollection, nowMs),
    recordModeProgress: normalizeRecordModeProgress(raw.recordModeProgress),
  };
}

export function createInitialAccountSave(): AccountSaveSnapshotV2 {
  return migrateAccountProgressionV1ToSaveV2(createInitialAccountProgression());
}

interface AccountSaveRow {
  readonly schema_version: number;
  readonly revision: number;
  readonly snapshot_json: string;
  readonly updated_at: number;
}

function rowToRecord(id: string, row: AccountSaveRow, nowMs = Date.now()): AccountSaveRecord {
  if (row.schema_version !== ACCOUNT_SAVE_SCHEMA_VERSION) {
    throw new Error(`unsupported stored account save schema:${row.schema_version}`);
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.snapshot_json); } catch { throw new Error('stored account save JSON is invalid'); }
  return {
    accountId: id,
    revision: nonNegativeInteger(row.revision, 'stored account save revision'),
    snapshot: normalizeAccountSaveSnapshot(decoded, nowMs),
    updatedAt: nonNegativeInteger(row.updated_at, 'stored account save updatedAt'),
  };
}

export async function loadAccountSave(db: D1Database, rawAccountId: string, nowMs = Date.now()): Promise<AccountSaveRecord | null> {
  const id = accountId(rawAccountId);
  const row = await db.prepare(
    'SELECT schema_version, revision, snapshot_json, updated_at FROM account_saves WHERE user_id = ?1',
  ).bind(id).first<AccountSaveRow>();
  return row ? rowToRecord(id, row, nowMs) : null;
}

export async function initializeAccountSave(
  db: D1Database,
  rawAccountId: string,
  snapshotValue?: unknown,
  nowMs = Date.now(),
): Promise<AccountSaveRecord> {
  const id = accountId(rawAccountId);
  const existing = await loadAccountSave(db, id, nowMs);
  if (existing) return existing;

  let snapshot: AccountSaveSnapshotV2;
  if (snapshotValue !== undefined) {
    snapshot = normalizeAccountSaveSnapshot(snapshotValue, nowMs);
  } else {
    const legacy = await loadAccountProgression(db, id);
    snapshot = legacy ? migrateAccountProgressionV1ToSaveV2(legacy.snapshot) : createInitialAccountSave();
  }

  await db.prepare(
    'INSERT OR IGNORE INTO account_saves (user_id, schema_version, revision, snapshot_json) VALUES (?1, ?2, 0, ?3)',
  ).bind(id, ACCOUNT_SAVE_SCHEMA_VERSION, JSON.stringify(snapshot)).run();
  const record = await loadAccountSave(db, id, nowMs);
  if (!record) throw new Error(`account save could not be initialized:${id}`);
  return record;
}

export async function replaceAccountSave(
  db: D1Database,
  rawAccountId: string,
  expectedRevision: number,
  snapshotValue: unknown,
  nowMs = Date.now(),
): Promise<ReplaceAccountSaveResult> {
  const id = accountId(rawAccountId);
  const expected = nonNegativeInteger(expectedRevision, 'expectedRevision');
  const snapshot = normalizeAccountSaveSnapshot(snapshotValue, nowMs);
  const result = await db.prepare(
    'UPDATE account_saves SET schema_version = ?1, revision = revision + 1, snapshot_json = ?2, updated_at = unixepoch() WHERE user_id = ?3 AND revision = ?4',
  ).bind(ACCOUNT_SAVE_SCHEMA_VERSION, JSON.stringify(snapshot), id, expected).run();
  if ((result.meta.changes ?? 0) !== 1) {
    const current = await loadAccountSave(db, id, nowMs);
    if (!current) throw new Error(`account save is not initialized:${id}`);
    return { ok: false, reason: 'revision_conflict', currentRevision: current.revision };
  }
  const record = await loadAccountSave(db, id, nowMs);
  if (!record) throw new Error(`account save disappeared after write:${id}`);
  return { ok: true, record };
}
