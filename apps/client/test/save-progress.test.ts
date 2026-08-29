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

test('session and durable guest progress merge NORMAL_CLEAR without duplicates and preserve first source', () => {
  const merged = normalizeGuestProgress(mergeGuestProgress(
    {
      clearedStageIds: [STAGE_1, STAGE_2],
      normalClearSourceByStage: { [STAGE_1]: 'COOP_BATTLE', [STAGE_2]: 'SOLO_BATTLE' },
      specialClearedStageIds: ['special-01'],
      permanentRewardIds: ['wind-badge'],
    },
    {
      clearedStageIds: [STAGE_2, STAGE_3],
      normalClearSourceByStage: { [STAGE_2]: 'COOP_BATTLE', [STAGE_3]: 'SOLO_BATTLE' },
      specialClearedStageIds: ['special-01', 'special-02'],
      permanentRewardIds: ['wind-badge', 'pot-token'],
    },
  ));

  assert.deepEqual(merged.clearedStageIds, [STAGE_1, STAGE_2, STAGE_3]);
  assert.equal(merged.normalClearSourceByStage?.[STAGE_1], 'COOP_BATTLE');
  assert.equal(merged.normalClearSourceByStage?.[STAGE_2], 'SOLO_BATTLE');
  assert.equal(merged.normalClearSourceByStage?.[STAGE_3], 'SOLO_BATTLE');
  assert.deepEqual(merged.specialClearedStageIds, ['special-01', 'special-02']);
  assert.deepEqual(merged.permanentRewardIds.slice(0, 3), ['wind-badge', 'barefoot-ribbon', 'pot-token']);
});

test('NORMAL_CLEAR normalization canonicalizes legacy stage ids, repairs guaranteed permanent rewards, and drops orphan clear sources', () => {
  const normalized = normalizeGuestProgress({
    clearedStageIds: ['border-01', 'border-03', 'border-16'],
    normalClearSourceByStage: {
      'border-01': 'COOP_BATTLE',
      'border-03': 'SOLO_BATTLE',
      'border-04': 'COOP_BATTLE',
    },
    specialClearedStageIds: ['special-01', 'missing-special'],
    permanentRewardIds: ['pot-token', 'wall-shadow', 'future-special-relic'],
  });

  assert.deepEqual(normalized.clearedStageIds, [STAGE_1]);
  assert.deepEqual(normalized.normalClearSourceByStage, { [STAGE_1]: 'COOP_BATTLE' });
  assert.deepEqual(normalized.specialClearedStageIds, ['special-01']);
  assert.deepEqual(normalized.permanentRewardIds, ['wind-badge', 'future-special-relic']);
  assert.equal(hasNormalClear(normalized, STAGE_1), true);
  assert.equal(hasNormalClear(normalized, 'border-01'), true, 'legacy callers are canonicalized at the save boundary');
  assert.equal(hasNormalClear(normalized, STAGE_3), false);
  assert.equal(getNormalClearSource(normalized, STAGE_1), 'COOP_BATTLE');
  assert.equal(getNormalClearSource(normalized, STAGE_3), undefined);
});

test('legacy progress without provenance migrates stage ids and defaults historical actual-battle source without inventing extra clears', () => {
  const normalized = normalizeGuestProgress({
    clearedStageIds: ['border-01', 'border-02'],
    specialClearedStageIds: [],
    permanentRewardIds: [],
  });
  assert.deepEqual(normalized.clearedStageIds, [STAGE_1, STAGE_2]);
  assert.deepEqual(normalized.normalClearSourceByStage, {
    [STAGE_1]: 'SOLO_BATTLE',
    [STAGE_2]: 'SOLO_BATTLE',
  });
  assert.deepEqual(normalized.permanentRewardIds, ['wind-badge', 'barefoot-ribbon']);

  const provenanceOnly = normalizeGuestProgress({
    clearedStageIds: [],
    normalClearSourceByStage: { 'border-01': 'COOP_BATTLE' },
    specialClearedStageIds: [],
    permanentRewardIds: [],
  });
  assert.deepEqual(provenanceOnly.clearedStageIds, []);
  assert.deepEqual(provenanceOnly.normalClearSourceByStage, {});
});

test('legacy border migration is bounded to the original twenty-stage chapter and never fabricates chapter-two clears', () => {
  const legacyChapterOne = Array.from({ length: 20 }, (_, index) => `border-${String(index + 1).padStart(2, '0')}`);
  const normalized = normalizeGuestProgress({
    clearedStageIds: [...legacyChapterOne, 'border-21'],
    specialClearedStageIds: [],
    permanentRewardIds: [],
  });
  assert.equal(normalized.clearedStageIds.length, 20);
  assert.equal(normalized.clearedStageIds[0], 'main_01_001');
  assert.equal(normalized.clearedStageIds.at(-1), 'main_01_020');
  assert.equal(normalized.clearedStageIds.includes('main_02_001'), false);
  assert.equal(hasNormalClear(normalized, 'border-21'), false);
});

test('save schema v11 persists the resource ledger and current progression fields while accepting older v2-v10 data for migration', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /const SCHEMA_VERSION = 11/);
  assert.match(source, /interface StoredGuestProgressV11/);
  assert.match(source, /permanentRewardIds: readonly string\[\]/);
  assert.match(source, /discoveredEnemyIds: readonly string\[\]/);
  assert.match(source, /resourceLedgerById: ResourceLedger/);
  assert.match(source, /\(version as number\) < 2 \|\| \(version as number\) > SCHEMA_VERSION/);
  assert.match(source, /versionNumber >= 8/);
  assert.match(source, /versionNumber >= 9 \? stringArray\(value\?\.permanentRewardIds\) : stringArray\(value\?\.treasureIds\)/);
  assert.match(source, /versionNumber >= 10 \? stringArray\(value\?\.discoveredEnemyIds\) : \[\]/);
  assert.match(source, /versionNumber >= 11 \? normalizeResourceLedger\(value\?\.resourceLedgerById\) : \{\}/);
  assert.match(source, /LEGACY_MAIN_STAGE_ID_MAP/);
  assert.match(source, /filter\(\(stage\) => stage\.id\.startsWith\('main_01_'\)\)/);
  assert.match(source, /canonicalStageIds\(value\?\.clearedStageIds\)/);
});

test('progression writer records only explicit actual-battle NORMAL_CLEAR and derives its permanent reward internally', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /export async function recordNormalStageClear\(stageId: string, source: NormalClearSource\)/);
  assert.match(source, /if \(!NORMAL_CLEAR_SOURCE_SET\.has\(source\)\)/);
  assert.match(source, /getStage\(canonicalStageId\(stageId\)\)/);
  assert.match(source, /if \(stage\.stageType !== 'PROGRESSION'\)/);
  assert.match(source, /if \(!stage\.permanentRewardId\)/);
  assert.match(source, /if \(!isStageUnlocked\(stage\.id, before\.clearedStageIds\)\)/);
  assert.match(source, /rewards\.add\(stage\.permanentRewardId\)/);
  assert.match(source, /if \(firstClear\) normalClearSourceByStage\[stage\.id\] = source/);
  assert.doesNotMatch(source, /export async function recordStageClear/);

  const resultSource = await readFile(new URL('../src/result-scene.ts', import.meta.url), 'utf8');
  assert.match(resultSource, /recordNormalStageClear\(this\.stage\.id, 'SOLO_BATTLE'\)/);
  assert.doesNotMatch(resultSource, /recordStageClear\(/);
});

test('SPECIAL writer still gates against the NORMAL_CLEAR progression axis and grants canonical resources', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /export async function recordSpecialStageClear/);
  assert.match(source, /if \(stage\.stageType !== 'SPECIAL'\)/);
  assert.match(source, /if \(!isSpecialStageUnlocked\(stage\.id, before\.clearedStageIds\)\)/);
  assert.match(source, /specialClears\.add\(stage\.id\)/);
  assert.match(source, /getSpecialResourceReward\(stage\.id, firstClear\)/);
  assert.match(source, /grantResources\(before\.resourceLedgerById \?\? \{\}, resourceReward\)/);
});

test('durable IndexedDB persistence remains distinct from in-tab session progress', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /sessionProgress = progress/);
  assert.match(source, /async function persistProgress/);
  assert.match(source, /return true/);
  assert.match(source, /return false/);
  assert.match(source, /persisted: await persistProgress\(progress\)/);
});

test('result screen never labels a failed durable write as saved', async () => {
  const source = await readFile(new URL('../src/result-scene.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(result\.persisted\)/);
  assert.match(source, /브라우저 영구 저장 실패 · 현재 탭에서는 진행 유지/);
  assert.match(source, /status\.setColor\('#ffb37c'\)/);
  assert.match(source, /재클리어 저장 완료/);
});
