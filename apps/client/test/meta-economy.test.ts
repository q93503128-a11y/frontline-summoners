import assert from 'node:assert/strict';
import test from 'node:test';
import { META_RESOURCE_IDS } from '@frontline/sim/resource-ledger';
import {
  getDuplicateDismantleSoulEssence,
  getLevelUpgradeGoldCost,
  getPlusLevelSoulEssenceCost,
  getRecruitmentCost,
} from '../src/meta-economy.ts';
import { MAIN_STAGE_RESOURCE_REWARDS } from '../src/main-stage-rewards.ts';

test('canonical recruitment costs are 100 per pull with no ten-pull discount', () => {
  assert.equal(getRecruitmentCost(1), 100);
  assert.equal(getRecruitmentCost(10), 1000);
});

test('canonical base-level gold curve totals 222230 gold from Lv1 to Lv50', () => {
  assert.equal(getLevelUpgradeGoldCost(1, 10), 1980);
  assert.equal(getLevelUpgradeGoldCost(10, 20), 6750);
  assert.equal(getLevelUpgradeGoldCost(20, 30), 21000);
  assert.equal(getLevelUpgradeGoldCost(30, 40), 57500);
  assert.equal(getLevelUpgradeGoldCost(40, 50), 135000);
  assert.equal(getLevelUpgradeGoldCost(1, 50), 222230);
});

test('duplicate dismantle and cross-character plus costs preserve the canonical 25 percent same-rarity conversion', () => {
  const rarities = ['C', 'B', 'A', 'S', 'SS'] as const;
  const dismantle = [4, 8, 20, 70, 220] as const;
  const costs = [16, 32, 80, 280, 880] as const;
  rarities.forEach((rarity, index) => {
    assert.equal(getDuplicateDismantleSoulEssence(rarity), dismantle[index]);
    assert.equal(getPlusLevelSoulEssenceCost('RECRUITMENT', rarity), costs[index]);
    assert.equal(costs[index], dismantle[index] * 4);
  });
  assert.equal(getPlusLevelSoulEssenceCost('STORY', null), 80);
});

test('main 80 currency table matches the detailed canonical campaign entries and milestone resources', () => {
  assert.equal(MAIN_STAGE_RESOURCE_REWARDS.length, 80);
  const totals = MAIN_STAGE_RESOURCE_REWARDS.reduce((sum, reward) => {
    for (const [id, amount] of Object.entries(reward.firstClearReward)) {
      sum[id] = (sum[id] ?? 0) + (amount ?? 0);
    }
    return sum;
  }, {} as Record<string, number>);
  assert.equal(totals.gold, 249160);
  assert.equal(totals.summon_crystal, 8470);
  assert.equal(totals.evo_fragment, 154);
  assert.equal(totals.evo_core, 25);
  assert.equal(totals.evo_crown, 4);
  assert.equal(totals.sweep_ticket, 44);

  const repeatGold = MAIN_STAGE_RESOURCE_REWARDS.reduce((sum, reward) => sum + (reward.repeatReward.gold ?? 0), 0);
  assert.ok(repeatGold > 0);
  assert.ok(MAIN_STAGE_RESOURCE_REWARDS.every((reward) => reward.repeatReward.summon_crystal === undefined));
});

test('sweep ticket is a first-class monotonic meta resource', () => {
  assert.ok(META_RESOURCE_IDS.includes('sweep_ticket'));
});
