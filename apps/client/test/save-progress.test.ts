import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { mergeGuestProgress, normalizeGuestProgress } from '../src/save.ts';

test('session and durable guest progress merge without duplicates while preserving first-seen order', () => {
  const merged = mergeGuestProgress(
    { clearedStageIds: ['border-01', 'border-02'], specialClearedStageIds: ['special-01'], treasureIds: ['wind-badge'] },
    { clearedStageIds: ['border-02', 'border-03'], specialClearedStageIds: ['special-01', 'special-02'], treasureIds: ['wind-badge', 'pot-token'] },
  );

  assert.deepEqual(merged.clearedStageIds, ['border-01', 'border-02', 'border-03']);
  assert.deepEqual(merged.specialClearedStageIds, ['special-01', 'special-02']);
  assert.deepEqual(merged.treasureIds, ['wind-badge', 'pot-token']);
});

test('progress normalization keeps progression sequential, validates special ids, and repairs guaranteed treasure', () => {
  const normalized = normalizeGuestProgress({
    clearedStageIds: ['border-01', 'border-03', 'border-16'],
    specialClearedStageIds: ['special-01', 'missing-special'],
    treasureIds: ['pot-token', 'wall-shadow', 'future-special-relic'],
  });

  assert.deepEqual(normalized.clearedStageIds, ['border-01']);
  assert.deepEqual(normalized.specialClearedStageIds, ['special-01']);
  assert.deepEqual(normalized.treasureIds, ['wind-badge', 'future-special-relic']);
});

test('save schema migrates v2 progress into v3 without losing chapter-one progression', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /const SCHEMA_VERSION = 3/);
  assert.match(source, /value\?\.schemaVersion !== 2 && value\?\.schemaVersion !== SCHEMA_VERSION/);
  assert.match(source, /value\.schemaVersion === SCHEMA_VERSION \? stringArray/);
  assert.match(source, /specialClearedStageIds: \[\]/);
});

test('progression and special clear writers validate their own authoritative stage axes', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(stage\.stageType !== 'PROGRESSION'\)/);
  assert.match(source, /if \(!isStageUnlocked\(stage\.id, before\.clearedStageIds\)\)/);
  assert.match(source, /if \(claimedTreasureId !== stage\.treasure\.id\)/);
  assert.match(source, /treasures\.add\(stage\.treasure\.id\)/);
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
  assert.match(source, /const persisted = await persistProgress\(progress\)/);
});

test('result screen never labels a failed durable write as saved', async () => {
  const source = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(result\.persisted\)/);
  assert.match(source, /브라우저 영구 저장 실패 · 현재 탭에서는 진행 유지/);
  assert.match(source, /status\.setColor\('#ffb37c'\)/);
  assert.match(source, /재클리어 저장 완료/);
});
