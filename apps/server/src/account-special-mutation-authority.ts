import { getMainStageResourceReward } from '@frontline/sim/main-stage-rewards';
import { grantResources, spendResources, type ResourceAmounts } from '@frontline/sim/resource-ledger';
import { resolveSpecialResourceReward } from '@frontline/sim/special-rewards';
import {
  initializeAccountSave,
  loadAccountSave,
  normalizeAccountSaveSnapshot,
  type AccountSaveRecord,
  type AccountSaveSnapshotV2,
} from './account-save-authority.ts';
import { initializeAccountProfile } from './account-profile-authority.ts';
import { mergeAccountEnemyDiscoveries, normalizeServerEnemyDiscoveries } from './account-enemy-discovery-authority.ts';
import { ACCOUNT_MAIN_STAGE_INDEX, ACCOUNT_SPECIAL_STAGE_IDS } from './account-content.ts';
import { assertAccountSpecialStagePlayable, getAccountStagePolicy } from './account-stage-authority.ts';

export const ACCOUNT_SPECIAL_MUTATION_KINDS = ['SPECIAL_BATTLE_RESULT', 'SWEEP'] as const;
export type AccountSpecialMutationKind = (typeof ACCOUNT_SPECIAL_MUTATION_KINDS)[number];

export interface AccountSpecialBattleMutationInput {
  readonly battleId: string;
  readonly expectedRevision: number;
  readonly stageId: string;
  readonly discoveredEnemyIds?: readonly string[];
}

export interface AccountSpecialBattleMutationResult {
  readonly stageId: string;
  readonly firstClear: boolean;
  readonly resourceReward: ResourceAmounts;
  readonly chargeConsumed: boolean;
  readonly periodicCollectionId?: string;
}

export interface AccountSweepMutationInput {
  readonly requestId: string;
  readonly expectedRevision: number;
  readonly stageId: string;
}

export interface AccountSweepMutationResult {
  readonly stageId: string;
  readonly spentResources: ResourceAmounts;
  readonly resourceReward: ResourceAmounts;
  readonly chargeConsumed: boolean;
  readonly periodicCollectionId?: string;
}

export type AccountSpecialMutationApplyResult<T> =
  | { readonly ok: true; readonly replayed: boolean; readonly record: AccountSaveRecord; readonly result: T }
  | { readonly ok: false; readonly reason: 'revision_conflict'; readonly currentRevision: number };

type ReceiptRow = {
  readonly input_fingerprint: string;
  readonly resulting_revision: number;
  readonly result_json: string;
};

type BuiltMutation<T> = {
  readonly snapshot: AccountSaveSnapshotV2;
  readonly result: T;
};

function nonEmptyId(value: string, context: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 128) throw new Error(`${context} must be 1..128 characters`);
  return trimmed;
}

function nonNegativeInteger(value: number, context: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${context} must be a non-negative integer`);
  return value;
}

function fingerprint(value: unknown): string {
  return JSON.stringify(value);
}

async function loadReceipt(
  db: D1Database,
  accountId: string,
  kind: AccountSpecialMutationKind,
  mutationId: string,
): Promise<ReceiptRow | null> {
  return db.prepare(
    'SELECT input_fingerprint, resulting_revision, result_json FROM account_mutation_receipts WHERE user_id = ?1 AND mutation_kind = ?2 AND mutation_id = ?3',
  ).bind(accountId, kind, mutationId).first<ReceiptRow>();
}

function parseReceipt<T>(row: ReceiptRow): T {
  try { return JSON.parse(row.result_json) as T; }
  catch { throw new Error('stored account special mutation receipt JSON is invalid'); }
}

async function resolveReplay<T>(
  db: D1Database,
  accountId: string,
  kind: AccountSpecialMutationKind,
  mutationId: string,
  inputFingerprint: string,
  nowMs: number,
): Promise<AccountSpecialMutationApplyResult<T> | null> {
  const receipt = await loadReceipt(db, accountId, kind, mutationId);
  if (!receipt) return null;
  if (receipt.input_fingerprint !== inputFingerprint) throw new Error(`idempotency key reused with different input:${kind}:${mutationId}`);
  const record = await loadAccountSave(db, accountId, nowMs);
  if (!record) throw new Error(`account save missing for mutation receipt:${accountId}`);
  if (record.revision < receipt.resulting_revision) throw new Error(`account save revision is behind mutation receipt:${mutationId}`);
  return { ok: true, replayed: true, record, result: parseReceipt<T>(receipt) };
}

async function commitMutation<T>(
  db: D1Database,
  rawAccountId: string,
  expectedRevision: number,
  kind: AccountSpecialMutationKind,
  rawMutationId: string,
  inputFingerprint: string,
  build: (snapshot: AccountSaveSnapshotV2) => BuiltMutation<T>,
  nowMs: number,
): Promise<AccountSpecialMutationApplyResult<T>> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  const mutationId = nonEmptyId(rawMutationId, 'mutationId');
  const expected = nonNegativeInteger(expectedRevision, 'expectedRevision');
  const current = await initializeAccountSave(db, accountId, undefined, nowMs);
  const replay = await resolveReplay<T>(db, accountId, kind, mutationId, inputFingerprint, nowMs);
  if (replay) return replay;
  if (current.revision !== expected) return { ok: false, reason: 'revision_conflict', currentRevision: current.revision };

  const built = build(current.snapshot);
  const nextSnapshot = normalizeAccountSaveSnapshot(built.snapshot, nowMs);
  const snapshotJson = JSON.stringify(nextSnapshot);
  const resultJson = JSON.stringify(built.result);
  const nextRevision = expected + 1;

  try {
    const writes = await db.batch([
      db.prepare(
        `UPDATE account_saves
         SET schema_version = 2,
             revision = CASE WHEN revision = ?3 THEN revision + 1 ELSE -1 END,
             snapshot_json = ?1,
             updated_at = unixepoch()
         WHERE user_id = ?2`,
      ).bind(snapshotJson, accountId, expected),
      db.prepare(
        `INSERT INTO account_mutation_receipts
         (user_id, mutation_kind, mutation_id, input_fingerprint, resulting_revision, result_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      ).bind(accountId, kind, mutationId, inputFingerprint, nextRevision, resultJson),
    ]);
    const saveWrite = writes[0];
    const receiptWrite = writes[1];
    if (!saveWrite || !receiptWrite) throw new Error('account special mutation batch returned incomplete results');
    if ((saveWrite.meta.changes ?? 0) !== 1 || (receiptWrite.meta.changes ?? 0) !== 1) {
      throw new Error(`account special mutation batch did not commit both rows:${kind}:${mutationId}`);
    }
  } catch (error) {
    const racedReplay = await resolveReplay<T>(db, accountId, kind, mutationId, inputFingerprint, nowMs);
    if (racedReplay) return racedReplay;
    const latest = await loadAccountSave(db, accountId, nowMs);
    if (latest && latest.revision !== expected) return { ok: false, reason: 'revision_conflict', currentRevision: latest.revision };
    throw error;
  }

  const record = await loadAccountSave(db, accountId, nowMs);
  if (!record || record.revision !== nextRevision) throw new Error(`account special mutation committed without expected save revision:${kind}:${mutationId}`);
  return { ok: true, replayed: false, record, result: built.result };
}

function buildSpecialBattleResult(
  snapshot: AccountSaveSnapshotV2,
  stageId: string,
  nowMs: number,
  availabilityAtMs = nowMs,
  discoveredEnemyIds: readonly string[] = [],
): BuiltMutation<AccountSpecialBattleMutationResult> {
  assertAccountSpecialStagePlayable(stageId, snapshot.clearedStageIds, snapshot.specialClearedStageIds, availabilityAtMs);
  const specialClearedStageIds = new Set(snapshot.specialClearedStageIds);
  const firstClear = !specialClearedStageIds.has(stageId);
  specialClearedStageIds.add(stageId);
  const resolution = resolveSpecialResourceReward(stageId, firstClear, snapshot.periodicRewardChargeByCollection, nowMs);
  const discovery = mergeAccountEnemyDiscoveries(snapshot, discoveredEnemyIds);
  const snapshotAfter = {
    ...discovery.snapshot,
    specialClearedStageIds: [...specialClearedStageIds],
    resourceLedgerById: grantResources(snapshot.resourceLedgerById, resolution.resourceReward),
    periodicRewardChargeByCollection: resolution.periodicChargeMap,
  };
  return {
    snapshot: snapshotAfter,
    result: {
      stageId,
      firstClear,
      resourceReward: resolution.resourceReward,
      chargeConsumed: resolution.chargeConsumed,
      ...(resolution.periodicCollectionId === undefined ? {} : { periodicCollectionId: resolution.periodicCollectionId }),
    },
  };
}

function buildSweepResult(
  snapshot: AccountSaveSnapshotV2,
  stageId: string,
  nowMs: number,
): BuiltMutation<AccountSweepMutationResult> {
  const isMain = ACCOUNT_MAIN_STAGE_INDEX.has(stageId);
  const isSpecial = ACCOUNT_SPECIAL_STAGE_IDS.has(stageId);
  if (!isMain && !isSpecial) throw new Error(`unknown sweep stage:${stageId}`);
  const policy = getAccountStagePolicy(stageId);
  if (policy.sweepEligibility !== 'AFTER_NORMAL_CLEAR') throw new Error(`stage does not allow sweep:${stageId}`);

  if (isMain) {
    if (!snapshot.clearedStageIds.includes(stageId)) throw new Error(`sweep requires prior NORMAL_CLEAR:${stageId}`);
  } else {
    if (!snapshot.specialClearedStageIds.includes(stageId)) throw new Error(`sweep requires prior NORMAL_CLEAR:${stageId}`);
    assertAccountSpecialStagePlayable(stageId, snapshot.clearedStageIds, snapshot.specialClearedStageIds, nowMs);
  }

  const spentResources: ResourceAmounts = { sweep_ticket: 1 };
  let resourceLedgerById = spendResources(snapshot.resourceLedgerById, spentResources);
  let periodicRewardChargeByCollection = snapshot.periodicRewardChargeByCollection;
  let resourceReward: ResourceAmounts;
  let chargeConsumed = false;
  let periodicCollectionId: string | undefined;

  if (isSpecial) {
    const resolution = resolveSpecialResourceReward(stageId, false, periodicRewardChargeByCollection, nowMs);
    resourceReward = resolution.resourceReward;
    periodicRewardChargeByCollection = resolution.periodicChargeMap;
    chargeConsumed = resolution.chargeConsumed;
    periodicCollectionId = resolution.periodicCollectionId;
  } else {
    resourceReward = getMainStageResourceReward(stageId, false);
  }
  resourceLedgerById = grantResources(resourceLedgerById, resourceReward);

  return {
    snapshot: { ...snapshot, resourceLedgerById, periodicRewardChargeByCollection },
    result: {
      stageId,
      spentResources,
      resourceReward,
      chargeConsumed,
      ...(periodicCollectionId === undefined ? {} : { periodicCollectionId }),
    },
  };
}

export async function applyAccountSpecialBattleResult(
  db: D1Database,
  accountId: string,
  input: AccountSpecialBattleMutationInput,
  nowMs = Date.now(),
  availabilityAtMs = nowMs,
): Promise<AccountSpecialMutationApplyResult<AccountSpecialBattleMutationResult>> {
  const battleId = nonEmptyId(input.battleId, 'battleId');
  const discoveredEnemyIds = normalizeServerEnemyDiscoveries(input.discoveredEnemyIds ?? []);
  const result = await commitMutation(
    db,
    accountId,
    input.expectedRevision,
    'SPECIAL_BATTLE_RESULT',
    battleId,
    fingerprint({ stageId: input.stageId, discoveredEnemyIds }),
    (snapshot) => buildSpecialBattleResult(snapshot, input.stageId, nowMs, availabilityAtMs, discoveredEnemyIds),
    nowMs,
  );
  // SPECIAL stage achievements include event cumulative profile rewards. Sync immediately after a
  // successful authoritative clear so the cosmetic is owned before the player opens the profile UI.
  if (result.ok) await initializeAccountProfile(db, accountId, nowMs);
  return result;
}

export async function applyAccountSweep(
  db: D1Database,
  accountId: string,
  input: AccountSweepMutationInput,
  nowMs = Date.now(),
): Promise<AccountSpecialMutationApplyResult<AccountSweepMutationResult>> {
  const requestId = nonEmptyId(input.requestId, 'requestId');
  return commitMutation(
    db,
    accountId,
    input.expectedRevision,
    'SWEEP',
    requestId,
    fingerprint({ stageId: input.stageId }),
    (snapshot) => buildSweepResult(snapshot, input.stageId, nowMs),
    nowMs,
  );
}

export const __accountSpecialMutationTestOnly = {
  buildSpecialBattleResult,
  buildSweepResult,
};