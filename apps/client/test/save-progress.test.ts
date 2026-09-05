import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  getNormalClearSource,
  hasNormalClear,
  mergeGuestProgress,
  normalizeGuestProgress,
} from '../src/save.ts';

const STAGE_1 = 'main_01_001';
const STAGE_2 = 'main_01_002';
const STAGE_3 = 'main_01_003';

test('session and durable guest progress merge NORMAL_CLEAR and rewarded-stage state without duplicates', () => {
  const merged = normalizeGuestProgress(mergeGuestProgress(
    {
      clearedStageIds: [STAGE_1, STAGE_2],
      normalClearSourceByStage: { [STAGE_1]: 'COOP_BATTLE', [STAGE_2]: 'SOLO_BATTLE' },
      mainRewardedStageIds: [STAGE_1],
      specialClearedStageIds: ['special-01'],
      permanentRewardIds: ['wind-badge'],
    },
    {
      clearedStageIds: [STAGE_2, STAGE_3],
      normalClearSourceByStage: { [STAGE_2]: 'COOP_BATTLE', [STAGE_3]: 'SOLO_BATTLE' },
      mainRewardedStageIds: [STAGE_2, STAGE_3],
      specialClearedStageIds: ['special-01', 'special-02'],
      permanentRewardIds: ['wind-badge', 'pot-token'],
    },
  ));

  assert.deepEqual(merged.clearedStageIds, [STAGE_1, STAGE_2, STAGE_3]);
  assert.equal(merged.normalClearSourceByStage?.[STAGE_1], 'COOP_BATTLE');
  assert.equal(merged.normalClearSourceByStage?.[STAGE_2], 'SOLO_BATTLE');
  assert.equal(merged.normalClearSourceByStage?.[STAGE_3], 'SOLO_BATTLE');
  assert.deepEqual(merged.mainRewardedStageIds, [STAGE_1, STAGE_2, STAGE_3]);
  assert.deepEqual(merged.specialClearedStageIds, ['special-01', 'special-02']);
  assert.deepEqual(merged.permanentRewardIds.slice(0, 3), ['wind-badge', 'barefoot-ribbon', 'pot-token']);
});

test('NORMAL_CLEAR normalization canonicalizes legacy stage ids, repairs guaranteed permanent rewards, and drops orphan clear sources', () => {
  const normalized = normalizeGuestProgress({
    clearedStageIds: ['border-01', 'border-03', 'border-16'],
    normalClearSourceByStage: { 'border-01': 'COOP_BATTLE', 'border-03': 'SOLO_BATTLE', 'border-04': 'COOP_BATTLE' },
    mainRewardedStageIds: ['border-01', 'border-03'],
    specialClearedStageIds: ['special-01', 'missing-special'],
    permanentRewardIds: ['pot-token', 'wall-shadow', 'future-special-relic'],
  });
  assert.deepEqual(normalized.clearedStageIds, [STAGE_1]);
  assert.deepEqual(normalized.normalClearSourceByStage, { [STAGE_1]: 'COOP_BATTLE' });
  assert.deepEqual(normalized.mainRewardedStageIds, [STAGE_1]);
  assert.deepEqual(normalized.specialClearedStageIds, ['special-01']);
  assert.deepEqual(normalized.permanentRewardIds, ['wind-badge', 'future-special-relic']);
  assert.equal(hasNormalClear(normalized, STAGE_1), true);
  assert.equal(hasNormalClear(normalized, 'border-01'), true, 'legacy callers are canonicalized at the save boundary');
  assert.equal(hasNormalClear(normalized, STAGE_3), false);
  assert.equal(getNormalClearSource(normalized, STAGE_1), 'COOP_BATTLE');
  assert.equal(getNormalClearSource(normalized, STAGE_3), undefined);
});

test('legacy progress without provenance migrates stage ids and defaults historical actual-battle source without inventing extra clears', () => {
  const normalized = normalizeGuestProgress({ clearedStageIds: ['border-01', 'border-02'], specialClearedStageIds: [], permanentRewardIds: [] });
  assert.deepEqual(normalized.clearedStageIds, [STAGE_1, STAGE_2]);
  assert.deepEqual(normalized.normalClearSourceByStage, { [STAGE_1]: 'SOLO_BATTLE', [STAGE_2]: 'SOLO_BATTLE' });
  assert.deepEqual(normalized.permanentRewardIds, ['wind-badge', 'barefoot-ribbon']);

  const provenanceOnly = normalizeGuestProgress({
    clearedStageIds: [], normalClearSourceByStage: { 'border-01': 'COOP_BATTLE' }, specialClearedStageIds: [], permanentRewardIds: [],
  });
  assert.deepEqual(provenanceOnly.clearedStageIds, []);
  assert.deepEqual(provenanceOnly.normalClearSourceByStage, {});
});

test('legacy border migration is bounded to the original twenty-stage chapter and never fabricates chapter-two clears', () => {
  const legacyChapterOne = Array.from({ length: 20 }, (_, index) => `border-${String(index + 1).padStart(2, '0')}`);
  const normalized = normalizeGuestProgress({ clearedStageIds: [...legacyChapterOne, 'border-21'], specialClearedStageIds: [], permanentRewardIds: [] });
  assert.equal(normalized.clearedStageIds.length, 20);
  assert.equal(normalized.clearedStageIds[0], 'main_01_001');
  assert.equal(normalized.clearedStageIds.at(-1), 'main_01_020');
  assert.equal(normalized.clearedStageIds.includes('main_02_001'), false);
  assert.equal(hasNormalClear(normalized, 'border-21'), false);
});

test('save schema v15 persists weapon selection and record reward high-water while migrating v2-v14', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /const SCHEMA_VERSION = 15/);
  assert.match(source, /interface StoredGuestProgressV15/);
  assert.match(source, /mainRewardedStageIds: readonly string\[\]/);
  assert.match(source, /resourceLedgerById: ResourceLedger/);
  assert.match(source, /periodicRewardChargeByCollection: PeriodicRewardChargeMap/);
  assert.match(source, /recordModeProgress: RecordModeProgress/);
  assert.match(source, /selectedBaseWeaponId: BaseWeaponId/);
  assert.match(source, /endlessRewardedMinute: number/);
  assert.match(source, /bossRushRewardedDefeated: number/);
  assert.match(source, /\(version as number\) < 2 \|\| \(version as number\) > SCHEMA_VERSION/);
  assert.match(source, /versionNumber >= 11 \? normalizeResourceLedger\(value\?\.resourceLedgerById\) : \{\}/);
  assert.match(source, /versionNumber >= 12 \? normalizeRecordModeProgress\(value\?\.recordModeProgress\) : EMPTY_RECORD_PROGRESS/);
  assert.match(source, /versionNumber >= 13 \? canonicalStageIds\(value\?\.mainRewardedStageIds\) : \[\]/);
  assert.match(source, /versionNumber >= 14 \? normalizePeriodicRewardChargeMap\(value\?\.periodicRewardChargeByCollection\) : createFullPeriodicRewardChargeMap\(\)/);
  assert.match(source, /versionNumber >= 15 && typeof value\?\.selectedBaseWeaponId === 'string'/);
  assert.match(source, /if \(versionNumber < 13\)/);
  assert.match(source, /getMainStageResourceReward\(migratedStageId, true\)/);
  assert.match(source, /readLegacyPeriodicSpecialChargeMap/);
  assert.match(source, /clearLegacyPeriodicSpecialChargeState/);
});

test('progression writer grants canonical first/repeat resources and preserves one-time permanent reward semantics', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /export async function recordNormalStageClear\(stageId: string, source: NormalClearSource\)/);
  assert.match(source, /if \(!isStageUnlocked\(stage\.id, before\.clearedStageIds\)\)/);
  assert.match(source, /const firstResourceReward = !rewardedStages\.has\(stage\.id\)/);
  assert.match(source, /rewardedStages\.add\(stage\.id\)/);
  assert.match(source, /getMainStageResourceReward\(stage\.id, firstResourceReward\)/);
  assert.match(source, /grantResources\(before\.resourceLedgerById \?\? \{\}, resourceReward\)/);
  assert.match(source, /if \(firstClear\) normalClearSourceByStage\[stage\.id\] = source/);

  const resultSource = await readFile(new URL('../src/result-scene.ts', import.meta.url), 'utf8');
  assert.match(resultSource, /recordNormalStageClear\(this\.stage\.id, 'SOLO_BATTLE'\)/);
  assert.match(resultSource, /formatResourceReward\(result\.resourceReward\)/);
});

test('SPECIAL writer enforces sortie gates and persists reward charge with the resource grant', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /export async function recordSpecialStageClear/);
  assert.match(source, /if \(stage\.stageType !== 'SPECIAL'\)/);
  assert.match(source, /if \(!isSortieStageUnlocked\(stage\.id, before\.clearedStageIds, before\.specialClearedStageIds, nowMs\)\)/);
  assert.match(source, /specialClears\.add\(stage\.id\)/);
  assert.match(source, /resolveSpecialResourceReward\(stage\.id, firstClear/);
  assert.match(source, /periodicRewardChargeByCollection: resolution\.periodicChargeMap/);
  assert.match(source, /grantResources\(before\.resourceLedgerById \?\? \{\}, resolution\.resourceReward\)/);
});

test('sweep authority requires a prior NORMAL_CLEAR, spends exactly one ticket, never creates first-clear state, and uses repeat rewards', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /export async function recordGuestStageSweep/);
  assert.match(source, /stage\.sweepEligibility !== 'AFTER_NORMAL_CLEAR'/);
  assert.match(source, /if \(!previouslyCleared\) throw new Error\(`Sweep requires prior NORMAL_CLEAR/);
  assert.match(source, /spentResources: ResourceAmounts = \{ sweep_ticket: 1 \}/);
  assert.match(source, /spendResources\(before\.resourceLedgerById \?\? \{\}, spentResources\)/);
  assert.match(source, /getMainStageResourceReward\(stage\.id, false\)/);
  assert.match(source, /resolveSpecialResourceReward\(stage\.id, false/);
  assert.match(source, /periodicRewardChargeByCollection/);
  assert.doesNotMatch(source, /recordGuestStageSweep[\s\S]*?cleared\.add\(stage\.id\)/);
});

test('durable IndexedDB persistence remains distinct from in-tab session progress', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /sessionProgress = progress/);
  assert.match(source, /async function persistProgress/);
  assert.match(source, /persisted: await persistProgress\(progress\)/);
});

test('result screen never labels a failed durable write as saved', async () => {
  const source = await readFile(new URL('../src/result-scene.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(result\.persisted\)/);
  assert.match(source, /브라우저 영구 저장 실패 · 현재 탭에서는 진행 유지/);
  assert.match(source, /setColor\(COLORS\.warning\)/);
  assert.match(source, /재클리어 보상 저장 완료/);
});
