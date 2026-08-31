import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { __guestMigrationNetworkTestOnly } from '../src/account-guest-migration-network.ts';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

const summary = {
  highestMainStageId: 'main_01_020',
  mainClearCount: 20,
  specialClearCount: 3,
  ownedCharacterCount: 6,
  discoveredEnemyCount: 12,
  resourceBalances: { gold: 1500, summon_crystal: 300 },
  endlessBestReachedMinute: 2,
  bossRushBestDefeated: 0,
};

test('migration preview parser keeps both guest and server summaries plus empty-account recommendation', () => {
  const parsed = __guestMigrationNetworkTestOnly.parseGuestMigrationPreview({
    sourceHash: 'ab'.repeat(32),
    capturedAtMs: 1_900_000_000_000,
    serverEmpty: true,
    accountRevision: 0,
    profileRevision: 0,
    guest: summary,
    server: { ...summary, highestMainStageId: null, mainClearCount: 0 },
    recommendedMode: 'IMPORT_IF_EMPTY',
  });
  assert.equal(parsed?.serverEmpty, true);
  assert.equal(parsed?.guest.mainClearCount, 20);
  assert.equal(parsed?.recommendedMode, 'IMPORT_IF_EMPTY');
  assert.equal(__guestMigrationNetworkTestOnly.parseGuestMigrationPreview({ ...summary, serverEmpty: true }), null);
});

test('migration transport uses bearer session, explicit source hash and current account revision without merge endpoint', async () => {
  const source = await readSource('../src/account-guest-migration-network.ts');
  assert.match(source, /frontline\.account\.sessionToken\.v1/);
  assert.match(source, /authorization: `Bearer \$\{token\}`/);
  assert.match(source, /\/api\/account\/migration\/preview/);
  assert.match(source, /\/api\/account\/migration\/commit/);
  assert.match(source, /\/api\/account\/migration\/rollback/);
  assert.match(source, /sourceHash: preview\.sourceHash/);
  assert.match(source, /expectedRevision/);
  assert.doesNotMatch(source, /MERGE_PROGRESS|mergeGuestProgress|\/migration\/merge/);
});

test('account scene presents compare, server-keep, destructive double-confirm replacement and immediate rollback', async () => {
  const scene = await readSource('../src/account-scene.ts');
  assert.match(scene, /게스트 진행 비교/);
  assert.match(scene, /게스트 진행 적용/);
  assert.match(scene, /취소 · 서버 유지/);
  assert.match(scene, /직전 이전 되돌리기/);
  assert.match(scene, /if \(!preview\.serverEmpty && !this\.replacementArmed\)/);
  assert.match(scene, /this\.replacementArmed = true/);
  assert.match(scene, /GUEST_REPLACE_CONFIRMATION/);
  assert.match(scene, /preview\.serverEmpty \? 'IMPORT_IF_EMPTY' : 'REPLACE_EXISTING'/);
  assert.match(scene, /자동 합치기하지 않습니다/);
  assert.match(scene, /rollbackAuthenticatedGuestMigration/);
});

test('automatic login proposal only runs when local guest progress is meaningful', async () => {
  const scene = await readSource('../src/account-scene.ts');
  assert.match(scene, /hasMeaningfulGuestProgress/);
  assert.match(scene, /await this\.prepareMigrationPreview\(true\)/);
  assert.match(scene, /이전할 게스트 진행이 없습니다/);
});
