import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { mergeGuestProgress, normalizeGuestProgress } from '../src/save.ts';

test('session and durable guest progress merge without duplicates while preserving first-seen order', () => {
  const merged = mergeGuestProgress(
    { clearedStageIds: ['border-01', 'border-02'], treasureIds: ['wind-badge'] },
    { clearedStageIds: ['border-02', 'border-03'], treasureIds: ['wind-badge', 'pot-token'] },
  );

  assert.deepEqual(merged.clearedStageIds, ['border-01', 'border-02', 'border-03']);
  assert.deepEqual(merged.treasureIds, ['wind-badge', 'pot-token']);
});

test('campaign progress normalization keeps progression sequential, repairs guaranteed treasure, and reserves special clears for a separate future field', () => {
  const normalized = normalizeGuestProgress({
    clearedStageIds: ['border-01', 'border-03', 'border-16', 'future-special-stage'],
    treasureIds: ['pot-token', 'wall-shadow', 'future-special-relic'],
  });

  assert.deepEqual(normalized.clearedStageIds, ['border-01']);
  assert.deepEqual(normalized.treasureIds, ['wind-badge', 'future-special-relic']);
});

test('recordStageClear validates the canonical stage reward and normalizes storage sources before merging', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /Current schema stores sequential PROGRESSION clears only/);
  assert.match(source, /const stored = normalizeGuestProgress\(await readStoredProgress\(db\)\);/);
  assert.match(source, /const currentSession = normalizeGuestProgress\(sessionProgress\);/);
  assert.match(source, /normalizeGuestProgress\(mergeGuestProgress\(stored, currentSession\)\)/);
  assert.match(source, /const stage = getStage\(stageId\);/);
  assert.match(source, /if \(!isStageUnlocked\(stage\.id, before\.clearedStageIds\)\)/);
  assert.match(source, /if \(claimedTreasureId !== stage\.treasure\.id\)/);
  assert.match(source, /treasures\.add\(stage\.treasure\.id\)/);
  assert.match(source, /nonStageTreasureIds/);
});

test('recordStageClear contract distinguishes durable IndexedDB persistence from in-tab session progress', async () => {
  const source = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(source, /readonly persisted: boolean/);
  assert.match(source, /sessionProgress = progress/);
  assert.match(source, /let persisted = false/);
  assert.match(source, /persisted = true/);
  assert.match(source, /return \{ firstClear, treasureNew, progress, persisted \}/);
  assert.match(source, /return sessionProgress/);
});

test('result screen never labels a failed durable write as saved', async () => {
  const source = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(result\.persisted\)/);
  assert.match(source, /브라우저 영구 저장 실패 · 현재 탭에서는 진행 유지/);
  assert.match(source, /status\.setColor\('#ffb37c'\)/);
  assert.match(source, /재클리어 저장 완료/);
});
