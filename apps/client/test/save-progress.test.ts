import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  getNormalClearSource,
  hasNormalClear,
  mergeGuestProgress,
  normalizeGuestProgress,
} from '../src/save.ts';

test('session and durable guest progress merge NORMAL_CLEAR without duplicates and preserve first source', () => {
  const merged = normalizeGuestProgress(mergeGuestProgress(
    {
      clearedStageIds: ['border-01', 'border-02'],
      normalClearSourceByStage: { 'border-01': 'COOP_BATTLE', 'border-02': 'SOLO_BATTLE' },
      specialClearedStageIds: ['special-01'],
      treasureIds: ['wind-badge'],
    },
    {
      clearedStageIds: ['border-02', 'border-03'],
      normalClearSourceByStage: { 'border-02': 'COOP_BATTLE', 'border-03': 'SOLO_BATTLE' },
      specialClearedStageIds: ['special-01', 'special-02'],
      treasureIds: ['wind-badge', 'pot-token'],
    },
  ));

  assert.deepEqual(merged.clearedStageIds, ['border-01', 'border-02', 'border-03']);
  assert.equal(merged.normalClearSourceByStage?.['border-01'], 'COOP_BATTLE');
  assert.equal(merged.normalClearSourceByStage?.['border-02'], 'SOLO_BATTLE');
  assert.equal(merged.normalClearSourceByStage?.['border-03'], 'SOLO_BATTLE');
  assert.deepEqual(merged.specialClearedStageIds, ['special-01', 'special-02']);
  assert.deepEqual(merged.treasureIds.slice(0, 3), ['wind-badge', 'pot-token', 'double-plank']);
});

test('NORMAL_CLEAR normalization is sequential, repairs guaranteed permanent rewards, and drops orphan clear sources', () => {
  const normalized = normalizeGuestProgress({
    clearedStageIds: ['border-01', 'border-03', 'border-16'],
    normalClearSourceByStage: {
      'border-01': 'COOP_BATTLE',
      'border-03': 'SOLO_BATTLE',
      'border-04': 'COOP_BATTLE',
    },
    specialClearedStageIds: ['special-01', 'missing-special'],
    treasureIds: ['pot-token', 'wall-shadow', 'future-special-relic'],
  });

  assert.deepEqual(normalized.clearedStageIds, ['border-01']);
  assert.deepEqual(normalized.normalClearSourceByStage, { 'border-01': 'COOP_BATTLE' });
  assert.deepEqual(normalized.specialClearedStageIds, ['special-01']);
  assert.deepEqual(normalized.treasureIds, ['wind-badge', 'future-special-relic']);
  assert.equal(hasNormalClear(normalized, 'border-01'), true);
  assert.equal(hasNormalClear(normalized, 'border-03'), false);
  assert.equal(getNormalClearSource(normalized, 'border-01'), 'COOP_BATTLE');
  assert.equal(getNormalClearSource(normalized, 'border-03'), undefined);
});

test('legacy progress without provenance migrates to the historical actual-battle source without inventing extra clears', () => {
  const normalized = normalizeGuestProgress({
    clearedStageIds: ['border-01', 'border-02'],
    specialClearedStageIds: [],
    treasureIds: [],
  });
  assert.deepEqual(normalized.normalClearSourceByStage, {
    'border-01': 'SOLO_BATTLE',
    'border-02': 'SOLO_BATTLE',
  });

  const provenanceOnly = normalizeGuestProgress({
    clearedStageIds: [],
    normalClearSourceByStage: { 'border-01': 'COOP_BATTLE' },
    specialClearedStageIds: [],
    treasureIds: [],
  });
  assert.deepEqual(provenanceOnly.clearedStageIds, []);
  assert.deepEqual(provenanceOnly.normalClearSourceByStage, {});
});

test('save schema v8 persists NORMAL_CLEAR provenance and accepts older v2-v7 data for migration', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /const SCHEMA_VERSION = 8/);
  assert.match(source, /interface StoredGuestProgressV8/);
  assert.match(source, /normalClearSourceByStage: Readonly<Record<string, NormalClearSource>>/);
  assert.match(source, /\(version as number\) < 2 \|\| \(version as number\) > SCHEMA_VERSION/);
  assert.match(source, /versionNumber >= 8/);
  assert.match(source, /normalizeNormalClearSourceMap\(\{\}, clearedStageIds\)/);
});

test('progression writer records only explicit actual-battle NORMAL_CLEAR and derives its permanent reward internally', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /export async function recordNormalStageClear\(stageId: string, source: NormalClearSource\)/);
  assert.match(source, /if \(!NORMAL_CLEAR_SOURCE_SET\.has\(source\)\)/);
  assert.match(source, /if \(stage\.stageType !== 'PROGRESSION'\)/);
  assert.match(source, /if \(!isStageUnlocked\(stage\.id, before\.clearedStageIds\)\)/);
  assert.match(source, /rewards\.add\(stage\.treasure\.id\)/);
  assert.match(source, /if \(firstClear\) normalClearSourceByStage\[stage\.id\] = source/);
  assert.doesNotMatch(source, /export async function recordStageClear/);

  const resultSource = await readFile(new URL('../src/result-scene.ts', import.meta.url), 'utf8');
  assert.match(resultSource, /recordNormalStageClear\(this\.stage\.id, 'SOLO_BATTLE'\)/);
  assert.doesNotMatch(resultSource, /recordStageClear\(/);
});

test('SPECIAL writer still gates against the NORMAL_CLEAR progression axis', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /export async function recordSpecialStageClear/);
  assert.match(source, /if \(stage\.stageType !== 'SPECIAL'\)/);
  assert.match(source, /if \(!isSpecialStageUnlocked\(stage\.id, before\.clearedStageIds\)\)/);
  assert.match(source, /specialClears\.add\(stage\.id\)/);
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
