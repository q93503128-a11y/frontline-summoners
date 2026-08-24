import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { mergeGuestProgress } from '../src/save.ts';

test('session and durable guest progress merge without duplicates while preserving first-seen order', () => {
  const merged = mergeGuestProgress(
    { clearedStageIds: ['border-01', 'border-02'], treasureIds: ['wind-badge'] },
    { clearedStageIds: ['border-02', 'border-03'], treasureIds: ['wind-badge', 'pot-token'] },
  );

  assert.deepEqual(merged.clearedStageIds, ['border-01', 'border-02', 'border-03']);
  assert.deepEqual(merged.treasureIds, ['wind-badge', 'pot-token']);
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
