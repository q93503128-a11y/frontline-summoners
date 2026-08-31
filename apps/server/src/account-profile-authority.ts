import {
  ACHIEVEMENTS,
  PVP_ACHIEVEMENT_TIERS,
  evaluateAchievements,
  normalizeAchievementFactIds,
  normalizeOwnedProfileCosmeticIds,
  normalizeProfileLoadout,
  normalizePvpAchievementTier,
  type AchievementEvaluation,
  type AchievementEvaluationInput,
  type AchievementFactId,
  type ProfileLoadout,
  type PvpAchievementTier,
} from '@frontline/sim/achievement-profile';
import {
  initializeAccountSave,
  type AccountSaveSnapshotV2,
} from './account-save-authority.ts';
import { getAccountOwnedCharacterIds } from './progression-authority.ts';
import { SERVER_EVOLUTION_FORMS } from './meta-content-v2.ts';

export const ACCOUNT_PROFILE_SCHEMA_VERSION = 1;
export const ACCOUNT_PROFILE_MUTATION_KIND = 'PROFILE_LOADOUT' as const;

export interface AccountProfileSnapshotV1 {
  readonly schemaVersion: 1;
  readonly claimedAchievementIds: readonly string[];
  readonly ownedCosmeticIds: readonly string[];
  readonly profileLoadout: ProfileLoadout;
  readonly factIds: readonly AchievementFactId[];
  readonly pvpBestTier?: PvpAchievementTier;
}

export interface AccountProfileRecord {
  readonly accountId: string;
  readonly revision: number;
  readonly snapshot: AccountProfileSnapshotV1;
  readonly evaluations: readonly AchievementEvaluation[];
  readonly completedCount: number;
  readonly updatedAt: number;
}

export interface AccountProfileMutationInput {
  readonly requestId: string;
  readonly expectedRevision: number;
  readonly profileLoadout: ProfileLoadout;
}

export interface AccountProfileMutationResult {
  readonly profileLoadout: ProfileLoadout;
}

export type AccountProfileMutationApplyResult =
  | {
      readonly ok: true;
      readonly replayed: boolean;
      readonly record: AccountProfileRecord;
      readonly result: AccountProfileMutationResult;
    }
  | {
      readonly ok: false;
      readonly reason: 'revision_conflict';
      readonly currentRevision: number;
    };

type AccountProfileRow = {
  readonly schema_version: number;
  readonly revision: number;
  readonly snapshot_json: string;
  readonly updated_at: number;
};

type ReceiptRow = {
  readonly input_fingerprint: string;
  readonly resulting_revision: number;
  readonly result_json: string;
};

const ACHIEVEMENT_ID_SET = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
const FORM_ORDER_BY_ID = new Map(SERVER_EVOLUTION_FORMS.map((form) => [form.formId, form.formOrder] as const));
const PVP_TIER_INDEX = new Map(PVP_ACHIEVEMENT_TIERS.map((tier, index) => [tier, index] as const));

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

function validAchievementIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && ACHIEVEMENT_ID_SET.has(entry)))];
}

export function buildAccountAchievementEvaluationInput(
  save: AccountSaveSnapshotV2,
  factIds: readonly AchievementFactId[] = [],
  pvpBestTier?: PvpAchievementTier,
): AchievementEvaluationInput {
  const ownedCharacterIds = getAccountOwnedCharacterIds(save);
  const characterProgress = ownedCharacterIds
    .map((characterId) => save.characterProgressById[characterId])
    .filter((entry) => entry !== undefined);
  let unlockedF2Count = 0;
  let unlockedF3Count = 0;
  for (const progress of characterProgress) {
    const orders = new Set(progress.unlockedFormIds.map((formId) => FORM_ORDER_BY_ID.get(formId)).filter((order) => order !== undefined));
    if (orders.has(2)) unlockedF2Count += 1;
    if (orders.has(3)) unlockedF3Count += 1;
  }
  const coopClearedStageIds = Object.entries(save.normalClearSourceByStage)
    .filter(([, source]) => source === 'COOP_BATTLE')
    .map(([stageId]) => stageId);
  return {
    mainClearedStageIds: save.clearedStageIds,
    specialClearedStageIds: save.specialClearedStageIds,
    maxCharacterLevel: characterProgress.reduce((max, progress) => Math.max(max, progress.level), 0),
    maxCharacterPlusLevel: characterProgress.reduce((max, progress) => Math.max(max, progress.plusLevel), 0),
    unlockedF2Count,
    unlockedF3Count,
    ownedCharacterCount: ownedCharacterIds.length,
    discoveredEnemyCount: new Set(save.discoveredEnemyIds).size,
    coopClearedStageIds,
    endlessBestReachedMinute: save.recordModeProgress.endlessBestReachedMinute,
    bossRushBestDefeated: save.recordModeProgress.bossRushBestDefeated,
    factIds,
    ...(pvpBestTier === undefined ? {} : { pvpBestTier }),
  };
}

export function normalizeAccountProfileSnapshot(
  value: unknown,
  save: AccountSaveSnapshotV2,
): { snapshot: AccountProfileSnapshotV1; evaluations: readonly AchievementEvaluation[] } {
  const raw = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== ACCOUNT_PROFILE_SCHEMA_VERSION) {
    throw new Error(`unsupported account profile schema:${String(raw.schemaVersion)}`);
  }
  const factIds = normalizeAchievementFactIds(raw.factIds);
  const pvpBestTier = normalizePvpAchievementTier(raw.pvpBestTier);
  const evaluations = evaluateAchievements(buildAccountAchievementEvaluationInput(save, factIds, pvpBestTier));
  const newlyCompleted = evaluations.filter((evaluation) => evaluation.complete).map((evaluation) => evaluation.achievementId);
  const claimedAchievementIds = [...new Set([...validAchievementIds(raw.claimedAchievementIds), ...newlyCompleted])];
  // Account cosmetics are never accepted from the client or trusted merely because they were present in storage.
  // Ownership is reconstructed from permanent server-side achievement claims plus defaults.
  const ownedCosmeticIds = normalizeOwnedProfileCosmeticIds([], claimedAchievementIds);
  const ownedCharacterIds = getAccountOwnedCharacterIds(save);
  const profileLoadout = normalizeProfileLoadout(raw.profileLoadout, ownedCosmeticIds, ownedCharacterIds);
  return {
    snapshot: {
      schemaVersion: ACCOUNT_PROFILE_SCHEMA_VERSION,
      claimedAchievementIds,
      ownedCosmeticIds,
      profileLoadout,
      factIds,
      ...(pvpBestTier === undefined ? {} : { pvpBestTier }),
    },
    evaluations,
  };
}

export function createInitialAccountProfile(save: AccountSaveSnapshotV2): AccountProfileSnapshotV1 {
  return normalizeAccountProfileSnapshot(undefined, save).snapshot;
}

function rowToRecord(accountId: string, row: AccountProfileRow, save: AccountSaveSnapshotV2): AccountProfileRecord {
  if (row.schema_version !== ACCOUNT_PROFILE_SCHEMA_VERSION) throw new Error(`unsupported stored account profile schema:${row.schema_version}`);
  let decoded: unknown;
  try { decoded = JSON.parse(row.snapshot_json); } catch { throw new Error('stored account profile JSON is invalid'); }
  const normalized = normalizeAccountProfileSnapshot(decoded, save);
  return {
    accountId,
    revision: nonNegativeInteger(row.revision, 'stored account profile revision'),
    snapshot: normalized.snapshot,
    evaluations: normalized.evaluations,
    completedCount: normalized.evaluations.filter((evaluation) => evaluation.complete).length,
    updatedAt: nonNegativeInteger(row.updated_at, 'stored account profile updatedAt'),
  };
}

async function loadProfileRow(db: D1Database, accountId: string): Promise<AccountProfileRow | null> {
  return db.prepare(
    'SELECT schema_version, revision, snapshot_json, updated_at FROM account_profiles WHERE user_id = ?1',
  ).bind(accountId).first<AccountProfileRow>();
}

export async function loadAccountProfile(
  db: D1Database,
  rawAccountId: string,
  nowMs = Date.now(),
): Promise<AccountProfileRecord | null> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  const save = await initializeAccountSave(db, accountId, undefined, nowMs);
  const row = await loadProfileRow(db, accountId);
  return row ? rowToRecord(accountId, row, save.snapshot) : null;
}

export async function initializeAccountProfile(
  db: D1Database,
  rawAccountId: string,
  nowMs = Date.now(),
): Promise<AccountProfileRecord> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  const save = await initializeAccountSave(db, accountId, undefined, nowMs);
  const existing = await loadProfileRow(db, accountId);
  if (!existing) {
    const initial = createInitialAccountProfile(save.snapshot);
    await db.prepare(
      'INSERT OR IGNORE INTO account_profiles (user_id, schema_version, revision, snapshot_json) VALUES (?1, ?2, 0, ?3)',
    ).bind(accountId, ACCOUNT_PROFILE_SCHEMA_VERSION, JSON.stringify(initial)).run();
  }
  return syncAccountProfileAchievements(db, accountId, nowMs);
}

async function syncAccountProfileAchievements(
  db: D1Database,
  rawAccountId: string,
  nowMs = Date.now(),
): Promise<AccountProfileRecord> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const save = await initializeAccountSave(db, accountId, undefined, nowMs);
    const row = await loadProfileRow(db, accountId);
    if (!row) {
      const initial = createInitialAccountProfile(save.snapshot);
      await db.prepare(
        'INSERT OR IGNORE INTO account_profiles (user_id, schema_version, revision, snapshot_json) VALUES (?1, ?2, 0, ?3)',
      ).bind(accountId, ACCOUNT_PROFILE_SCHEMA_VERSION, JSON.stringify(initial)).run();
      continue;
    }
    const record = rowToRecord(accountId, row, save.snapshot);
    const canonicalJson = JSON.stringify(record.snapshot);
    if (canonicalJson === row.snapshot_json) return record;
    const write = await db.prepare(
      'UPDATE account_profiles SET revision = revision + 1, snapshot_json = ?1, updated_at = unixepoch() WHERE user_id = ?2 AND revision = ?3',
    ).bind(canonicalJson, accountId, row.revision).run();
    if ((write.meta.changes ?? 0) === 1) continue;
  }
  const save = await initializeAccountSave(db, accountId, undefined, nowMs);
  const row = await loadProfileRow(db, accountId);
  if (!row) throw new Error(`account profile could not be initialized:${accountId}`);
  return rowToRecord(accountId, row, save.snapshot);
}

function fingerprint(input: AccountProfileMutationInput): string {
  return JSON.stringify({ profileLoadout: input.profileLoadout });
}

function parseReceipt(row: ReceiptRow): AccountProfileMutationResult {
  try { return JSON.parse(row.result_json) as AccountProfileMutationResult; }
  catch { throw new Error('stored account profile mutation receipt JSON is invalid'); }
}

async function loadReceipt(db: D1Database, accountId: string, requestId: string): Promise<ReceiptRow | null> {
  return db.prepare(
    'SELECT input_fingerprint, resulting_revision, result_json FROM account_profile_mutation_receipts WHERE user_id = ?1 AND request_id = ?2',
  ).bind(accountId, requestId).first<ReceiptRow>();
}

async function resolveReplay(
  db: D1Database,
  accountId: string,
  requestId: string,
  inputFingerprint: string,
  nowMs: number,
): Promise<AccountProfileMutationApplyResult | null> {
  const receipt = await loadReceipt(db, accountId, requestId);
  if (!receipt) return null;
  if (receipt.input_fingerprint !== inputFingerprint) throw new Error(`idempotency key reused with different input:${ACCOUNT_PROFILE_MUTATION_KIND}:${requestId}`);
  const record = await syncAccountProfileAchievements(db, accountId, nowMs);
  if (record.revision < receipt.resulting_revision) throw new Error(`account profile revision is behind mutation receipt:${requestId}`);
  return { ok: true, replayed: true, record, result: parseReceipt(receipt) };
}

export async function applyAccountProfileLoadout(
  db: D1Database,
  rawAccountId: string,
  input: AccountProfileMutationInput,
  nowMs = Date.now(),
): Promise<AccountProfileMutationApplyResult> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  const requestId = nonEmptyId(input.requestId, 'requestId');
  const expectedRevision = nonNegativeInteger(input.expectedRevision, 'expectedRevision');
  const inputFingerprint = fingerprint(input);
  const current = await initializeAccountProfile(db, accountId, nowMs);
  const replay = await resolveReplay(db, accountId, requestId, inputFingerprint, nowMs);
  if (replay) return replay;
  if (current.revision !== expectedRevision) return { ok: false, reason: 'revision_conflict', currentRevision: current.revision };

  const save = await initializeAccountSave(db, accountId, undefined, nowMs);
  const profileLoadout = normalizeProfileLoadout(input.profileLoadout, current.snapshot.ownedCosmeticIds, getAccountOwnedCharacterIds(save.snapshot));
  const nextSnapshot: AccountProfileSnapshotV1 = { ...current.snapshot, profileLoadout };
  const nextRevision = expectedRevision + 1;
  const result: AccountProfileMutationResult = { profileLoadout };

  try {
    const writes = await db.batch([
      db.prepare(
        `UPDATE account_profiles
         SET revision = CASE WHEN revision = ?3 THEN revision + 1 ELSE -1 END,
             snapshot_json = ?1,
             updated_at = unixepoch()
         WHERE user_id = ?2`,
      ).bind(JSON.stringify(nextSnapshot), accountId, expectedRevision),
      db.prepare(
        `INSERT INTO account_profile_mutation_receipts
         (user_id, request_id, input_fingerprint, resulting_revision, result_json)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
      ).bind(accountId, requestId, inputFingerprint, nextRevision, JSON.stringify(result)),
    ]);
    const profileWrite = writes[0];
    const receiptWrite = writes[1];
    if (!profileWrite || !receiptWrite) throw new Error('account profile mutation batch returned incomplete results');
    if ((profileWrite.meta.changes ?? 0) !== 1 || (receiptWrite.meta.changes ?? 0) !== 1) {
      throw new Error(`account profile mutation batch did not commit both rows:${requestId}`);
    }
  } catch (error) {
    const racedReplay = await resolveReplay(db, accountId, requestId, inputFingerprint, nowMs);
    if (racedReplay) return racedReplay;
    const latest = await initializeAccountProfile(db, accountId, nowMs);
    if (latest.revision !== expectedRevision) return { ok: false, reason: 'revision_conflict', currentRevision: latest.revision };
    throw error;
  }

  const record = await initializeAccountProfile(db, accountId, nowMs);
  if (record.revision !== nextRevision) throw new Error(`account profile mutation committed without expected profile revision:${requestId}`);
  return { ok: true, replayed: false, record, result };
}

export async function recordAccountAchievementFact(
  db: D1Database,
  rawAccountId: string,
  factId: AchievementFactId,
  nowMs = Date.now(),
): Promise<AccountProfileRecord> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await initializeAccountProfile(db, accountId, nowMs);
    if (current.snapshot.factIds.includes(factId)) return current;
    const nextFactIds = normalizeAchievementFactIds([...current.snapshot.factIds, factId]);
    const write = await db.prepare(
      'UPDATE account_profiles SET revision = revision + 1, snapshot_json = ?1, updated_at = unixepoch() WHERE user_id = ?2 AND revision = ?3',
    ).bind(JSON.stringify({ ...current.snapshot, factIds: nextFactIds }), accountId, current.revision).run();
    if ((write.meta.changes ?? 0) === 1) return syncAccountProfileAchievements(db, accountId, nowMs);
  }
  return syncAccountProfileAchievements(db, accountId, nowMs);
}

export async function recordAccountPvpAchievementTier(
  db: D1Database,
  rawAccountId: string,
  tier: PvpAchievementTier,
  nowMs = Date.now(),
): Promise<AccountProfileRecord> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await initializeAccountProfile(db, accountId, nowMs);
    const currentIndex = current.snapshot.pvpBestTier === undefined ? -1 : (PVP_TIER_INDEX.get(current.snapshot.pvpBestTier) ?? -1);
    const nextIndex = PVP_TIER_INDEX.get(tier) ?? -1;
    if (nextIndex <= currentIndex) return current;
    const write = await db.prepare(
      'UPDATE account_profiles SET revision = revision + 1, snapshot_json = ?1, updated_at = unixepoch() WHERE user_id = ?2 AND revision = ?3',
    ).bind(JSON.stringify({ ...current.snapshot, pvpBestTier: tier }), accountId, current.revision).run();
    if ((write.meta.changes ?? 0) === 1) return syncAccountProfileAchievements(db, accountId, nowMs);
  }
  return syncAccountProfileAchievements(db, accountId, nowMs);
}

export const __accountProfileTestOnly = {
  buildAccountAchievementEvaluationInput,
  normalizeAccountProfileSnapshot,
};
