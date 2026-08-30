import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { grantResources, getResourceBalance } from '@frontline/sim/resource-ledger';
import { MAIN_STAGE_RESOURCE_REWARDS } from '@frontline/sim/main-stage-rewards';
import { createInitialAccountSave, normalizeAccountSaveSnapshot } from '../src/account-save-authority.ts';
import { ACCOUNT_MAIN_STAGES, ACCOUNT_SPECIAL_STAGE_IDS } from '../src/account-content.ts';
import { __accountMutationTestOnly } from '../src/account-mutation-authority.ts';
import { SERVER_RECRUITMENT_BANNERS, type ServerRecruitmentRandomSource } from '../src/recruitment-authority.ts';

const NOW = Date.parse('2026-08-30T09:30:00Z');
const BANNER_ID = SERVER_RECRUITMENT_BANNERS[0]!.id;

function fixedRng(values: readonly number[]): ServerRecruitmentRandomSource {
  let index = 0;
  return {
    nextInt(maxExclusive: number): number {
      const value = values[index++] ?? 0;
      if (value < 0 || value >= maxExclusive) throw new Error(`test RNG value ${value} outside ${maxExclusive}`);
      return value;
    },
  };
}

function clearThrough(count: number) {
  let snapshot = createInitialAccountSave();
  for (const reward of MAIN_STAGE_RESOURCE_REWARDS.slice(0, count)) {
    snapshot = __accountMutationTestOnly.buildMainBattleResult(snapshot, reward.stageId, 'SOLO_BATTLE').snapshot;
  }
  return snapshot;
}

test('account authority catalog covers canonical MAIN80 and SPECIAL61', () => {
  assert.equal(ACCOUNT_MAIN_STAGES.length, 80);
  assert.equal(ACCOUNT_MAIN_STAGES[19]?.id, 'main_01_020');
  assert.equal(ACCOUNT_MAIN_STAGES[20]?.id, 'main_02_001');
  assert.equal(ACCOUNT_MAIN_STAGES[59]?.id, 'main_03_020');
  assert.equal(ACCOUNT_MAIN_STAGES[79]?.id, 'main_04_020');
  assert.equal(ACCOUNT_SPECIAL_STAGE_IDS.size, 61);
  assert.equal(SERVER_RECRUITMENT_BANNERS.length, 3);
  assert.equal(BANNER_ID, 'starlight-order-01');
});

test('authoritative MAIN result grants first-clear once and repeat reward thereafter', () => {
  const initial = createInitialAccountSave();
  assert.throws(() => __accountMutationTestOnly.buildMainBattleResult(initial, 'main_01_002', 'SOLO_BATTLE'), /not unlocked/);

  const first = __accountMutationTestOnly.buildMainBattleResult(initial, 'main_01_001', 'COOP_BATTLE');
  assert.equal(first.result.firstClear, true);
  assert.equal(first.result.permanentRewardNew, true);
  assert.deepEqual(first.result.resourceReward, { gold: 150, summon_crystal: 40 });
  assert.equal(first.result.normalClearSource, 'COOP_BATTLE');
  assert.deepEqual(first.snapshot.mainRewardedStageIds, ['main_01_001']);
  assert.equal(getResourceBalance(first.snapshot.resourceLedgerById, 'gold'), 150);

  const repeat = __accountMutationTestOnly.buildMainBattleResult(first.snapshot, 'main_01_001', 'SOLO_BATTLE');
  assert.equal(repeat.result.firstClear, false);
  assert.equal(repeat.result.permanentRewardNew, false);
  assert.deepEqual(repeat.result.resourceReward, { gold: 30 });
  assert.equal(repeat.result.normalClearSource, 'COOP_BATTLE');
  assert.equal(getResourceBalance(repeat.snapshot.resourceLedgerById, 'gold'), 180);
});

test('authoritative MAIN result crosses chapter boundaries without losing contiguous authority', () => {
  const chapterOneClear = clearThrough(20);
  const next = __accountMutationTestOnly.buildMainBattleResult(chapterOneClear, 'main_02_001', 'SOLO_BATTLE');
  assert.equal(next.result.firstClear, true);
  assert.equal(next.snapshot.clearedStageIds.length, 21);
  assert.equal(next.snapshot.clearedStageIds[20], 'main_02_001');
});

test('authoritative record mutation uses server frames and only grants newly crossed high-water', () => {
  const chapterThreeClear = clearThrough(60);
  const twoMinutes = __accountMutationTestOnly.buildRecordResult(chapterThreeClear, {
    battleId: 'record-1', expectedRevision: 0, mode: 'ENDLESS_FRONT', survivalFrames: 3600,
  });
  assert.equal(twoMinutes.result.improved, true);
  assert.equal(twoMinutes.result.recordModeProgress.endlessBestReachedMinute, 2);
  assert.deepEqual(twoMinutes.result.resourceReward, { gold: 2000, sweep_ticket: 1 });

  const lowerRetryAsNewBattle = __accountMutationTestOnly.buildRecordResult(twoMinutes.snapshot, {
    battleId: 'record-2', expectedRevision: 0, mode: 'ENDLESS_FRONT', survivalFrames: 1800,
  });
  assert.equal(lowerRetryAsNewBattle.result.improved, false);
  assert.deepEqual(lowerRetryAsNewBattle.result.resourceReward, {});
  assert.equal(lowerRetryAsNewBattle.snapshot.recordModeProgress.endlessRewardedMinute, 2);
  assert.throws(() => __accountMutationTestOnly.buildRecordResult(chapterThreeClear, {
    battleId: 'boss-locked', expectedRevision: 0, mode: 'BOSS_RUSH', defeatedBosses: 1,
  }), /BOSS_RUSH is locked/);

  const chapterFourClear = clearThrough(80);
  const boss = __accountMutationTestOnly.buildRecordResult(chapterFourClear, {
    battleId: 'boss-1', expectedRevision: 0, mode: 'BOSS_RUSH', defeatedBosses: 3,
  });
  assert.deepEqual(boss.result.resourceReward, { gold: 4000, evo_fragment: 4 });
  assert.equal(boss.result.recordModeProgress.bossRushRewardedDefeated, 3);
});

test('server recruitment spends crystal and resolves duplicate plus or dismantle without client authority', () => {
  const funded = normalizeAccountSaveSnapshot({
    ...createInitialAccountSave(),
    resourceLedgerById: grantResources({}, { summon_crystal: 500 }),
  }, NOW);

  const first = __accountMutationTestOnly.buildRecruitmentResult(funded, {
    requestId: 'pull-1', expectedRevision: 0, bannerId: BANNER_ID, count: 1, duplicatePolicy: 'APPLY_PLUS',
  }, fixedRng([0, 0]));
  const characterId = first.result.results[0]!.characterId;
  assert.equal(first.result.results[0]!.duplicate, false);
  assert.equal(getResourceBalance(first.snapshot.resourceLedgerById, 'summon_crystal'), 400);
  assert.ok(first.snapshot.ownedRecruitmentCharacterIds.includes(characterId));

  const duplicatePlus = __accountMutationTestOnly.buildRecruitmentResult(first.snapshot, {
    requestId: 'pull-2', expectedRevision: 0, bannerId: BANNER_ID, count: 1, duplicatePolicy: 'APPLY_PLUS',
  }, fixedRng([0, 0]));
  assert.equal(duplicatePlus.result.results[0]!.duplicateResolution, 'PLUS');
  assert.equal(duplicatePlus.result.results[0]!.plusLevelAfter, 1);
  assert.equal(duplicatePlus.snapshot.characterProgressById[characterId]!.plusLevel, 1);

  const duplicateDismantle = __accountMutationTestOnly.buildRecruitmentResult(duplicatePlus.snapshot, {
    requestId: 'pull-3', expectedRevision: 0, bannerId: BANNER_ID, count: 1, duplicatePolicy: 'DISMANTLE',
  }, fixedRng([0, 0]));
  assert.equal(duplicateDismantle.result.results[0]!.duplicateResolution, 'DISMANTLE');
  assert.equal(duplicateDismantle.result.dismantledSoulEssence, 4);
  assert.equal(getResourceBalance(duplicateDismantle.snapshot.resourceLedgerById, 'soul_essence'), 4);
  assert.equal(getResourceBalance(duplicateDismantle.snapshot.resourceLedgerById, 'summon_crystal'), 200);
});

test('recruitment rejects unsupported batch sizes before any authoritative result can be built', () => {
  const funded = normalizeAccountSaveSnapshot({
    ...createInitialAccountSave(),
    resourceLedgerById: grantResources({}, { summon_crystal: 5000 }),
  }, NOW);
  assert.throws(() => __accountMutationTestOnly.buildRecruitmentResult(funded, {
    requestId: 'bad-count', expectedRevision: 0, bannerId: BANNER_ID, count: 5 as 1, duplicatePolicy: 'APPLY_PLUS',
  }, fixedRng([])), /count must be 1 or 10/);
});

test('D1 mutation receipt migration makes battle/request ids unique per account and mutation kind', async () => {
  const sql = await readFile(new URL('../migrations/0004_account_mutation_receipts.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS account_mutation_receipts/);
  assert.match(sql, /MAIN_BATTLE_RESULT/);
  assert.match(sql, /RECORD_RESULT/);
  assert.match(sql, /RECRUITMENT/);
  assert.match(sql, /PRIMARY KEY \(user_id, mutation_kind, mutation_id\)/);
  assert.match(sql, /input_fingerprint TEXT NOT NULL/);
  assert.match(sql, /result_json TEXT NOT NULL/);
});

test('mutation source uses rollback-safe CAS before inserting idempotency receipt', async () => {
  const source = await readFile(new URL('../src/account-mutation-authority.ts', import.meta.url), 'utf8');
  assert.match(source, /revision = CASE WHEN revision = \?3 THEN revision \+ 1 ELSE -1 END/);
  assert.match(source, /INSERT INTO account_mutation_receipts/);
  assert.match(source, /idempotency key reused with different input/);
});
