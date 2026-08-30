import { getMainStageResourceReward } from '@frontline/sim/main-stage-rewards';
import {
  getBossRushMilestoneReward,
  getEndlessRecordMilestoneReward,
  BOSS_RUSH_REWARD_CAP_DEFEATED,
} from '@frontline/sim/record-rewards';
import {
  getDuplicateDismantleSoulEssence,
  getRecruitmentCost,
} from '@frontline/sim/meta-economy';
import {
  grantResources,
  spendResources,
  type ResourceAmounts,
} from '@frontline/sim/resource-ledger';
import stagesJson from '../../../content/stages/chapter-01.json' with { type: 'json' };
import {
  initializeAccountSave,
  loadAccountSave,
  normalizeAccountSaveSnapshot,
  type AccountRecordModeProgress,
  type AccountSaveRecord,
  type AccountSaveSnapshotV2,
} from './account-save-authority.ts';
import {
  SERVER_CHARACTER_LEVEL_CURVE,
  SERVER_EVOLUTION_FORMS,
} from './meta-content-v2.ts';
import {
  rollServerRecruitment,
  SERVER_CRYPTO_RECRUITMENT_RANDOM_SOURCE,
  type ServerRecruitmentRandomSource,
  type ServerRecruitmentPull,
} from './recruitment-authority.ts';
import type { AccountCharacterProgress, AccountNormalClearSource } from './progression-authority.ts';

export const ACCOUNT_MUTATION_KINDS = ['MAIN_BATTLE_RESULT', 'RECORD_RESULT', 'RECRUITMENT'] as const;
export type AccountMutationKind = (typeof ACCOUNT_MUTATION_KINDS)[number];
export const ACCOUNT_DUPLICATE_POLICIES = ['APPLY_PLUS', 'DISMANTLE'] as const;
export type AccountDuplicatePolicy = (typeof ACCOUNT_DUPLICATE_POLICIES)[number];

export interface AccountMainBattleMutationInput {
  readonly battleId: string;
  readonly expectedRevision: number;
  readonly stageId: string;
  readonly source: AccountNormalClearSource;
}

export interface AccountMainBattleMutationResult {
  readonly stageId: string;
  readonly firstClear: boolean;
  readonly permanentRewardNew: boolean;
  readonly resourceReward: ResourceAmounts;
  readonly normalClearSource: AccountNormalClearSource;
}

export type AccountRecordMutationInput =
  | {
      readonly battleId: string;
      readonly expectedRevision: number;
      readonly mode: 'ENDLESS_FRONT';
      readonly survivalFrames: number;
    }
  | {
      readonly battleId: string;
      readonly expectedRevision: number;
      readonly mode: 'BOSS_RUSH';
      readonly defeatedBosses: number;
    };

export interface AccountRecordMutationResult {
  readonly mode: 'ENDLESS_FRONT' | 'BOSS_RUSH';
  readonly improved: boolean;
  readonly resourceReward: ResourceAmounts;
  readonly recordModeProgress: AccountRecordModeProgress;
}

export interface AccountRecruitmentMutationInput {
  readonly requestId: string;
  readonly expectedRevision: number;
  readonly bannerId: string;
  readonly count: 1 | 10;
  readonly duplicatePolicy: AccountDuplicatePolicy;
}

export interface AccountRecruitmentPullResult extends ServerRecruitmentPull {
  readonly duplicateResolution?: 'PLUS' | 'DISMANTLE';
  readonly plusLevelAfter?: number;
  readonly dismantledSoulEssence?: number;
}

export interface AccountRecruitmentMutationResult {
  readonly bannerId: string;
  readonly count: 1 | 10;
  readonly duplicatePolicy: AccountDuplicatePolicy;
  readonly spentResources: ResourceAmounts;
  readonly dismantledSoulEssence: number;
  readonly results: readonly AccountRecruitmentPullResult[];
}

export type AccountMutationApplyResult<T> =
  | {
      readonly ok: true;
      readonly replayed: boolean;
      readonly record: AccountSaveRecord;
      readonly result: T;
    }
  | {
      readonly ok: false;
      readonly reason: 'revision_conflict';
      readonly currentRevision: number;
    };

type MainStageSeed = {
  readonly id: string;
  readonly permanentRewardId?: string;
};

type AccountMutationReceiptRow = {
  readonly input_fingerprint: string;
  readonly resulting_revision: number;
  readonly result_json: string;
};

type BuiltMutation<T> = {
  readonly snapshot: AccountSaveSnapshotV2;
  readonly result: T;
};

const MAIN_STAGES = stagesJson as unknown as readonly MainStageSeed[];
const MAIN_STAGE_INDEX = new Map(MAIN_STAGES.map((stage, index) => [stage.id, index] as const));
const MAIN_STAGE_BY_ID = new Map(MAIN_STAGES.map((stage) => [stage.id, stage] as const));
const NORMAL_CLEAR_SOURCES = new Set<AccountNormalClearSource>(['SOLO_BATTLE', 'COOP_BATTLE']);
const DUPLICATE_POLICIES = new Set<AccountDuplicatePolicy>(ACCOUNT_DUPLICATE_POLICIES);
const BASE_FORM_ID_BY_CHARACTER = new Map<string, string>();
for (const form of SERVER_EVOLUTION_FORMS) {
  if (!BASE_FORM_ID_BY_CHARACTER.has(form.characterId)) BASE_FORM_ID_BY_CHARACTER.set(form.characterId, form.formId);
}

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

function parseReceiptResult<T>(row: AccountMutationReceiptRow): T {
  try {
    return JSON.parse(row.result_json) as T;
  } catch {
    throw new Error('stored account mutation receipt JSON is invalid');
  }
}

async function loadReceipt(
  db: D1Database,
  accountId: string,
  kind: AccountMutationKind,
  mutationId: string,
): Promise<AccountMutationReceiptRow | null> {
  return db.prepare(
    'SELECT input_fingerprint, resulting_revision, result_json FROM account_mutation_receipts WHERE user_id = ?1 AND mutation_kind = ?2 AND mutation_id = ?3',
  ).bind(accountId, kind, mutationId).first<AccountMutationReceiptRow>();
}

async function resolveReplay<T>(
  db: D1Database,
  accountId: string,
  kind: AccountMutationKind,
  mutationId: string,
  inputFingerprint: string,
  nowMs: number,
): Promise<AccountMutationApplyResult<T> | null> {
  const receipt = await loadReceipt(db, accountId, kind, mutationId);
  if (!receipt) return null;
  if (receipt.input_fingerprint !== inputFingerprint) throw new Error(`idempotency key reused with different input:${kind}:${mutationId}`);
  const record = await loadAccountSave(db, accountId, nowMs);
  if (!record) throw new Error(`account save missing for mutation receipt:${accountId}`);
  if (record.revision < receipt.resulting_revision) throw new Error(`account save revision is behind mutation receipt:${mutationId}`);
  return { ok: true, replayed: true, record, result: parseReceiptResult<T>(receipt) };
}

async function commitMutation<T>(
  db: D1Database,
  rawAccountId: string,
  expectedRevision: number,
  kind: AccountMutationKind,
  rawMutationId: string,
  inputFingerprint: string,
  build: (snapshot: AccountSaveSnapshotV2) => BuiltMutation<T>,
  nowMs = Date.now(),
): Promise<AccountMutationApplyResult<T>> {
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
    const [saveWrite, receiptWrite] = await db.batch([
      db.prepare(
        'UPDATE account_saves SET schema_version = 2, revision = revision + 1, snapshot_json = ?1, updated_at = unixepoch() WHERE user_id = ?2 AND revision = ?3',
      ).bind(snapshotJson, accountId, expected),
      db.prepare(
        `INSERT INTO account_mutation_receipts (user_id, mutation_kind, mutation_id, input_fingerprint, resulting_revision, result_json)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6
         WHERE EXISTS (
           SELECT 1 FROM account_saves WHERE user_id = ?1 AND revision = ?5 AND snapshot_json = ?7
         )`,
      ).bind(accountId, kind, mutationId, inputFingerprint, nextRevision, resultJson, snapshotJson),
    ]);

    if ((saveWrite.meta.changes ?? 0) !== 1) {
      const racedReplay = await resolveReplay<T>(db, accountId, kind, mutationId, inputFingerprint, nowMs);
      if (racedReplay) return racedReplay;
      const latest = await loadAccountSave(db, accountId, nowMs);
      if (!latest) throw new Error(`account save disappeared during mutation:${accountId}`);
      return { ok: false, reason: 'revision_conflict', currentRevision: latest.revision };
    }
    if ((receiptWrite.meta.changes ?? 0) !== 1) throw new Error(`account mutation receipt was not committed:${kind}:${mutationId}`);
  } catch (error) {
    const racedReplay = await resolveReplay<T>(db, accountId, kind, mutationId, inputFingerprint, nowMs);
    if (racedReplay) return racedReplay;
    throw error;
  }

  const record = await loadAccountSave(db, accountId, nowMs);
  if (!record || record.revision !== nextRevision) throw new Error(`account mutation committed without expected save revision:${kind}:${mutationId}`);
  return { ok: true, replayed: false, record, result: built.result };
}

function buildMainBattleResult(
  snapshot: AccountSaveSnapshotV2,
  stageId: string,
  source: AccountNormalClearSource,
): BuiltMutation<AccountMainBattleMutationResult> {
  if (!NORMAL_CLEAR_SOURCES.has(source)) throw new Error(`invalid NORMAL_CLEAR source:${source}`);
  const stage = MAIN_STAGE_BY_ID.get(stageId);
  const stageIndex = MAIN_STAGE_INDEX.get(stageId);
  if (!stage || stageIndex === undefined) throw new Error(`unknown MAIN stage:${stageId}`);
  if (!stage.permanentRewardId) throw new Error(`MAIN stage is missing permanent reward:${stageId}`);

  const cleared = new Set(snapshot.clearedStageIds);
  const firstClear = !cleared.has(stageId);
  if (firstClear && stageIndex !== snapshot.clearedStageIds.length) throw new Error(`MAIN stage is not unlocked:${stageId}`);

  const rewardedStages = new Set(snapshot.mainRewardedStageIds);
  const rewards = new Set(snapshot.permanentRewardIds);
  const firstResourceReward = !rewardedStages.has(stageId);
  const permanentRewardNew = !rewards.has(stage.permanentRewardId);
  const normalClearSourceByStage = { ...snapshot.normalClearSourceByStage };
  if (firstClear) {
    cleared.add(stageId);
    normalClearSourceByStage[stageId] = source;
  }
  rewardedStages.add(stageId);
  rewards.add(stage.permanentRewardId);
  const resourceReward = getMainStageResourceReward(stageId, firstResourceReward);
  const resourceLedgerById = grantResources(snapshot.resourceLedgerById, resourceReward);

  const next = normalizeAccountSaveSnapshot({
    ...snapshot,
    clearedStageIds: [...cleared],
    normalClearSourceByStage,
    mainRewardedStageIds: [...rewardedStages],
    permanentRewardIds: [...rewards],
    resourceLedgerById,
  });
  return {
    snapshot: next,
    result: {
      stageId,
      firstClear,
      permanentRewardNew,
      resourceReward,
      normalClearSource: next.normalClearSourceByStage[stageId]!,
    },
  };
}

function buildRecordResult(snapshot: AccountSaveSnapshotV2, input: AccountRecordMutationInput): BuiltMutation<AccountRecordMutationResult> {
  const current = snapshot.recordModeProgress;
  if (input.mode === 'ENDLESS_FRONT') {
    if (!snapshot.clearedStageIds.includes('main_03_020')) throw new Error('ENDLESS_FRONT is locked');
    const survivalFrames = nonNegativeInteger(input.survivalFrames, 'survivalFrames');
    const survivalMs = Math.floor(survivalFrames * 1000 / 30);
    const reachedMinute = Math.floor(survivalFrames / (30 * 60));
    const improved = survivalMs > current.endlessBestTimeMs;
    const bestTimeMs = Math.max(current.endlessBestTimeMs, survivalMs);
    const bestReachedMinute = Math.max(current.endlessBestReachedMinute, reachedMinute, Math.floor(bestTimeMs / 60_000));
    const rewardedMinute = Math.max(current.endlessRewardedMinute, bestReachedMinute);
    const resourceReward = getEndlessRecordMilestoneReward(current.endlessRewardedMinute, rewardedMinute);
    const recordModeProgress: AccountRecordModeProgress = {
      ...current,
      endlessBestTimeMs: bestTimeMs,
      endlessBestReachedMinute: bestReachedMinute,
      endlessRewardedMinute: rewardedMinute,
    };
    const next = normalizeAccountSaveSnapshot({
      ...snapshot,
      recordModeProgress,
      resourceLedgerById: grantResources(snapshot.resourceLedgerById, resourceReward),
    });
    return { snapshot: next, result: { mode: input.mode, improved, resourceReward, recordModeProgress: next.recordModeProgress } };
  }

  if (!snapshot.clearedStageIds.includes('main_04_020')) throw new Error('BOSS_RUSH is locked');
  const defeatedBosses = nonNegativeInteger(input.defeatedBosses, 'defeatedBosses');
  if (defeatedBosses > BOSS_RUSH_REWARD_CAP_DEFEATED) throw new Error('BOSS_RUSH result exceeds runtime boss count');
  const improved = defeatedBosses > current.bossRushBestDefeated;
  const bestDefeated = Math.max(current.bossRushBestDefeated, defeatedBosses);
  const rewardedDefeated = Math.max(current.bossRushRewardedDefeated, bestDefeated);
  const resourceReward = getBossRushMilestoneReward(current.bossRushRewardedDefeated, rewardedDefeated);
  const recordModeProgress: AccountRecordModeProgress = {
    ...current,
    bossRushBestDefeated: bestDefeated,
    bossRushRewardedDefeated: rewardedDefeated,
  };
  const next = normalizeAccountSaveSnapshot({
    ...snapshot,
    recordModeProgress,
    resourceLedgerById: grantResources(snapshot.resourceLedgerById, resourceReward),
  });
  return { snapshot: next, result: { mode: input.mode, improved, resourceReward, recordModeProgress: next.recordModeProgress } };
}

function initialRecruitmentProgress(characterId: string): AccountCharacterProgress {
  const baseFormId = BASE_FORM_ID_BY_CHARACTER.get(characterId);
  if (!baseFormId) throw new Error(`recruitment character has no base evolution form:${characterId}`);
  return { level: 1, plusLevel: 0, unlockedFormIds: [baseFormId], selectedFormId: baseFormId };
}

function buildRecruitmentResult(
  snapshot: AccountSaveSnapshotV2,
  input: AccountRecruitmentMutationInput,
  rng: ServerRecruitmentRandomSource,
): BuiltMutation<AccountRecruitmentMutationResult> {
  if (input.count !== 1 && input.count !== 10) throw new Error('recruitment count must be 1 or 10');
  if (!DUPLICATE_POLICIES.has(input.duplicatePolicy)) throw new Error(`unknown duplicate policy:${input.duplicatePolicy}`);
  const spentResources: ResourceAmounts = { summon_crystal: getRecruitmentCost(input.count) };
  let resourceLedgerById = spendResources(snapshot.resourceLedgerById, spentResources);
  const pulls = rollServerRecruitment(input.bannerId, input.count, snapshot.ownedRecruitmentCharacterIds, rng);
  const ownedRecruitmentCharacterIds = new Set(snapshot.ownedRecruitmentCharacterIds);
  const characterProgressById: Record<string, AccountCharacterProgress> = { ...snapshot.characterProgressById };
  const results: AccountRecruitmentPullResult[] = [];
  let dismantledSoulEssence = 0;

  for (const pull of pulls) {
    if (!pull.duplicate) {
      ownedRecruitmentCharacterIds.add(pull.characterId);
      characterProgressById[pull.characterId] ??= initialRecruitmentProgress(pull.characterId);
      results.push(pull);
      continue;
    }

    const current = characterProgressById[pull.characterId] ?? initialRecruitmentProgress(pull.characterId);
    characterProgressById[pull.characterId] = current;
    if (input.duplicatePolicy === 'APPLY_PLUS' && current.plusLevel < SERVER_CHARACTER_LEVEL_CURVE.plusLevelCap) {
      const plusLevelAfter = current.plusLevel + 1;
      characterProgressById[pull.characterId] = { ...current, plusLevel: plusLevelAfter };
      results.push({ ...pull, duplicateResolution: 'PLUS', plusLevelAfter });
      continue;
    }

    const dismantledSoulEssenceForPull = getDuplicateDismantleSoulEssence(pull.rarity);
    dismantledSoulEssence += dismantledSoulEssenceForPull;
    results.push({ ...pull, duplicateResolution: 'DISMANTLE', dismantledSoulEssence: dismantledSoulEssenceForPull });
  }

  if (dismantledSoulEssence > 0) {
    resourceLedgerById = grantResources(resourceLedgerById, { soul_essence: dismantledSoulEssence });
  }
  const next = normalizeAccountSaveSnapshot({
    ...snapshot,
    ownedRecruitmentCharacterIds: [...ownedRecruitmentCharacterIds],
    characterProgressById,
    resourceLedgerById,
  });
  return {
    snapshot: next,
    result: {
      bannerId: input.bannerId,
      count: input.count,
      duplicatePolicy: input.duplicatePolicy,
      spentResources,
      dismantledSoulEssence,
      results,
    },
  };
}

export async function applyAccountMainBattleResult(
  db: D1Database,
  accountId: string,
  input: AccountMainBattleMutationInput,
  nowMs = Date.now(),
): Promise<AccountMutationApplyResult<AccountMainBattleMutationResult>> {
  const battleId = nonEmptyId(input.battleId, 'battleId');
  const inputFingerprint = fingerprint({ stageId: input.stageId, source: input.source });
  return commitMutation(db, accountId, input.expectedRevision, 'MAIN_BATTLE_RESULT', battleId, inputFingerprint,
    (snapshot) => buildMainBattleResult(snapshot, input.stageId, input.source), nowMs);
}

export async function applyAccountRecordResult(
  db: D1Database,
  accountId: string,
  input: AccountRecordMutationInput,
  nowMs = Date.now(),
): Promise<AccountMutationApplyResult<AccountRecordMutationResult>> {
  const battleId = nonEmptyId(input.battleId, 'battleId');
  const inputFingerprint = input.mode === 'ENDLESS_FRONT'
    ? fingerprint({ mode: input.mode, survivalFrames: input.survivalFrames })
    : fingerprint({ mode: input.mode, defeatedBosses: input.defeatedBosses });
  return commitMutation(db, accountId, input.expectedRevision, 'RECORD_RESULT', battleId, inputFingerprint,
    (snapshot) => buildRecordResult(snapshot, input), nowMs);
}

export async function applyAccountRecruitment(
  db: D1Database,
  accountId: string,
  input: AccountRecruitmentMutationInput,
  rng: ServerRecruitmentRandomSource = SERVER_CRYPTO_RECRUITMENT_RANDOM_SOURCE,
  nowMs = Date.now(),
): Promise<AccountMutationApplyResult<AccountRecruitmentMutationResult>> {
  const requestId = nonEmptyId(input.requestId, 'requestId');
  const inputFingerprint = fingerprint({
    bannerId: input.bannerId,
    count: input.count,
    duplicatePolicy: input.duplicatePolicy,
  });
  return commitMutation(db, accountId, input.expectedRevision, 'RECRUITMENT', requestId, inputFingerprint,
    (snapshot) => buildRecruitmentResult(snapshot, input, rng), nowMs);
}

export const __accountMutationTestOnly = {
  buildMainBattleResult,
  buildRecordResult,
  buildRecruitmentResult,
};
