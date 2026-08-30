import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getResourceBalance, grantResources } from '@frontline/sim/resource-ledger';
import { PERIODIC_SPECIAL_REWARDS, SPECIAL_RESOURCE_REWARDS } from '@frontline/sim/special-rewards';
import { createInitialAccountSave, normalizeAccountSaveSnapshot } from '../src/account-save-authority.ts';
import { __accountMutationTestOnly } from '../src/account-mutation-authority.ts';
import { getAccountStagePolicy, isAccountStageAvailable } from '../src/account-stage-authority.ts';
import { __accountSpecialMutationTestOnly } from '../src/account-special-mutation-authority.ts';

const OPEN_NOW = Date.parse('2026-08-30T09:30:00+09:00');
const CLOSED_EVENT_TIME = Date.parse('2026-07-01T12:00:00+09:00');

function clearThrough(count: number) {
  let snapshot = createInitialAccountSave();
  for (let index = 0; index < count; index += 1) {
    const stageId = `main_${String(Math.floor(index / 20) + 1).padStart(2, '0')}_${String(index % 20 + 1).padStart(3, '0')}`;
    snapshot = __accountMutationTestOnly.buildMainBattleResult(snapshot, stageId, 'SOLO_BATTLE').snapshot;
  }
  return snapshot;
}

test('shared SPECIAL reward catalog covers all rewarded runtime SPECIAL stages', () => {
  assert.equal(PERIODIC_SPECIAL_REWARDS.length, 18);
  assert.equal(SPECIAL_RESOURCE_REWARDS.length, 38);
  const ids = [...PERIODIC_SPECIAL_REWARDS, ...SPECIAL_RESOURCE_REWARDS].map((entry) => entry.stageId);
  assert.equal(new Set(ids).size, 56);
});

test('server SPECIAL access enforces collection progression, sequential unlock and availability', () => {
  const initial = createInitialAccountSave();
  assert.throws(() => __accountSpecialMutationTestOnly.buildSpecialBattleResult(initial, 'special_gold_convoy_01', OPEN_NOW), /collection is locked/);

  const mainThree = clearThrough(3);
  const baseGold = getResourceBalance(mainThree.resourceLedgerById, 'gold');
  const first = __accountSpecialMutationTestOnly.buildSpecialBattleResult(mainThree, 'special_gold_convoy_01', OPEN_NOW);
  assert.equal(first.result.firstClear, true);
  assert.equal(first.result.chargeConsumed, false);
  assert.deepEqual(first.result.resourceReward, { gold: 600, sweep_ticket: 1 });
  assert.equal(getResourceBalance(first.snapshot.resourceLedgerById, 'gold'), baseGold + 600);
  assert.equal(getResourceBalance(first.snapshot.resourceLedgerById, 'sweep_ticket'), 1);
  assert.throws(() => __accountSpecialMutationTestOnly.buildSpecialBattleResult(first.snapshot, 'special_gold_convoy_02', OPEN_NOW), /progression gate is locked/);

  const mainTen = clearThrough(10);
  const seeded = normalizeAccountSaveSnapshot({ ...mainTen, specialClearedStageIds: ['special_gold_convoy_01'] }, OPEN_NOW);
  const second = __accountSpecialMutationTestOnly.buildSpecialBattleResult(seeded, 'special_gold_convoy_02', OPEN_NOW);
  assert.equal(second.result.firstClear, true);
  assert.deepEqual(second.result.resourceReward, { gold: 1200 });

  assert.equal(isAccountStageAvailable('event_summer_01_01', CLOSED_EVENT_TIME), false);
  const mainTwenty = clearThrough(20);
  assert.throws(() => __accountSpecialMutationTestOnly.buildSpecialBattleResult(mainTwenty, 'event_summer_01_01', CLOSED_EVENT_TIME), /not currently available/);
});

test('periodic SPECIAL repeat consumes exactly one charge and uses charged reward', () => {
  const mainThree = clearThrough(3);
  const baseGold = getResourceBalance(mainThree.resourceLedgerById, 'gold');
  const first = __accountSpecialMutationTestOnly.buildSpecialBattleResult(mainThree, 'special_gold_convoy_01', OPEN_NOW);
  const repeat = __accountSpecialMutationTestOnly.buildSpecialBattleResult(first.snapshot, 'special_gold_convoy_01', OPEN_NOW);
  assert.equal(repeat.result.firstClear, false);
  assert.equal(repeat.result.chargeConsumed, true);
  assert.equal(repeat.result.periodicCollectionId, 'special_gold_convoy');
  assert.deepEqual(repeat.result.resourceReward, { gold: 450 });
  assert.equal(repeat.snapshot.periodicRewardChargeByCollection.special_gold_convoy.charges, 3);
  assert.equal(getResourceBalance(repeat.snapshot.resourceLedgerById, 'gold'), baseGold + 1050);
});

test('server sweep requires NORMAL_CLEAR, spends one ticket and never creates progression', () => {
  const mainOne = clearThrough(1);
  const funded = normalizeAccountSaveSnapshot({
    ...mainOne,
    resourceLedgerById: grantResources(mainOne.resourceLedgerById, { sweep_ticket: 2 }),
  }, OPEN_NOW);
  const mainSweep = __accountSpecialMutationTestOnly.buildSweepResult(funded, 'main_01_001', OPEN_NOW);
  assert.deepEqual(mainSweep.result.spentResources, { sweep_ticket: 1 });
  assert.deepEqual(mainSweep.result.resourceReward, { gold: 30 });
  assert.equal(getResourceBalance(mainSweep.snapshot.resourceLedgerById, 'sweep_ticket'), 1);
  assert.deepEqual(mainSweep.snapshot.clearedStageIds, funded.clearedStageIds);
  assert.deepEqual(mainSweep.snapshot.specialClearedStageIds, funded.specialClearedStageIds);

  const mainThree = clearThrough(3);
  assert.throws(() => __accountSpecialMutationTestOnly.buildSweepResult(mainThree, 'special_gold_convoy_01', OPEN_NOW), /prior NORMAL_CLEAR/);

  const specialFirst = __accountSpecialMutationTestOnly.buildSpecialBattleResult(mainThree, 'special_gold_convoy_01', OPEN_NOW);
  const specialSweep = __accountSpecialMutationTestOnly.buildSweepResult(specialFirst.snapshot, 'special_gold_convoy_01', OPEN_NOW);
  assert.equal(specialSweep.result.chargeConsumed, true);
  assert.deepEqual(specialSweep.result.resourceReward, { gold: 450 });
  assert.equal(getResourceBalance(specialSweep.snapshot.resourceLedgerById, 'sweep_ticket'), 0);
  assert.equal(specialSweep.snapshot.periodicRewardChargeByCollection.special_gold_convoy.charges, 3);
  assert.deepEqual(specialSweep.snapshot.specialClearedStageIds, ['special_gold_convoy_01']);

  assert.throws(() => __accountSpecialMutationTestOnly.buildSweepResult(specialSweep.snapshot, 'special_gold_convoy_01', OPEN_NOW), /Insufficient meta resource/);
});

test('server stage policy is authoritative for sweep eligibility', () => {
  assert.equal(getAccountStagePolicy('main_01_001').sweepEligibility, 'AFTER_NORMAL_CLEAR');
  assert.equal(getAccountStagePolicy('special_gold_convoy_01').rewardChargePolicy, 'COLLECTION_CHARGE');
});

test('D1 migration widens receipts for SPECIAL battle and sweep while keeping battleId globally unique', async () => {
  const sql = await readFile(new URL('../migrations/0005_account_special_sweep_mutations.sql', import.meta.url), 'utf8');
  assert.match(sql, /SPECIAL_BATTLE_RESULT/);
  assert.match(sql, /SWEEP/);
  assert.match(sql, /INSERT INTO account_mutation_receipts_v2/);
  assert.match(sql, /DROP TABLE account_mutation_receipts/);
  assert.match(sql, /MAIN_BATTLE_RESULT', 'SPECIAL_BATTLE_RESULT', 'RECORD_RESULT/);
});
