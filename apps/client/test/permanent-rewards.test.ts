import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENEMIES,
  PLAYER_SLOTS,
  STAGES,
  createPrototypeBattle,
  getPermanentRewardIdsForClearedStages,
  getUnlockedSlotIds,
} from '../src/prototype.ts';
import {
  PERMANENT_REWARDS,
  applyPercent,
  applyPermanentRewardBattleEffects,
} from '../src/permanent-rewards.ts';

test('every chapter-one progression stage has exactly one permanent reward definition', () => {
  const stageRewardIds = STAGES.map((stage) => stage.permanentRewardId);
  assert.equal(stageRewardIds.every((rewardId): rewardId is string => typeof rewardId === 'string'), true);
  const rewardIds = PERMANENT_REWARDS.map((reward) => reward.id).sort();
  assert.deepEqual(rewardIds, [...stageRewardIds].sort());
  assert.equal(new Set(rewardIds).size, 20);
});

test('cleared stage ids resolve to permanent reward ids in stage order', () => {
  const cleared = [STAGES[0]!.id, STAGES[1]!.id, STAGES[2]!.id];
  assert.deepEqual(
    getPermanentRewardIdsForClearedStages(cleared),
    [STAGES[0]!.permanentRewardId, STAGES[1]!.permanentRewardId, STAGES[2]!.permanentRewardId],
  );
});

test('chapter-one starting supply reward is canonical +5%', () => {
  const stage = STAGES[1]!;
  const unlocked = getUnlockedSlotIds([STAGES[0]!.id]);
  const baseline = createPrototypeBattle(stage.id, unlocked, []);
  const rewarded = createPrototypeBattle(stage.id, unlocked, ['wind-badge']);

  assert.equal(baseline.supply, stage.startingSupply);
  assert.equal(rewarded.supply, applyPercent(stage.startingSupply, 5, 0));
  assert.notEqual(baseline.stateHash, rewarded.stateHash, 'permanent progression must be part of deterministic battle identity');
});

test('same-stat permanent bonuses add before they are applied', () => {
  const output = applyPermanentRewardBattleEffects({
    ownedRewardIds: ['barefoot-ribbon', 'fallen-crest', 'mace-ring', 'ember-vial'],
    startingSupply: 500,
    playerBaseHp: 5000,
    playerSlots: PLAYER_SLOTS,
    enemies: ENEMIES,
  });
  const byId = new Map(output.playerSlots.map((slot) => [slot.slotId, slot]));
  const guard = PLAYER_SLOTS.find((slot) => slot.slotId === 'guard')!;
  const hunter = PLAYER_SLOTS.find((slot) => slot.slotId === 'hunter')!;

  assert.equal(byId.get('guard')!.definition.maxHp, applyPercent(guard.definition.maxHp, 14));
  assert.equal(byId.get('hunter')!.definition.maxHp, applyPercent(hunter.definition.maxHp, 9));
});

test('explicit reward scopes control FRONTLINE and RANGED bonuses without range inference', () => {
  const output = applyPermanentRewardBattleEffects({
    ownedRewardIds: ['pot-token', 'moon-pass', 'mask-thread', 'glass-splinter', 'clear-lens', 'iron-bolt'],
    startingSupply: 500,
    playerBaseHp: 5000,
    playerSlots: PLAYER_SLOTS,
    enemies: ENEMIES,
  });
  const byId = new Map(output.playerSlots.map((slot) => [slot.slotId, slot]));
  const guard = PLAYER_SLOTS.find((slot) => slot.slotId === 'guard')!;
  const hunter = PLAYER_SLOTS.find((slot) => slot.slotId === 'hunter')!;

  assert.deepEqual(guard.rewardScopes, ['FRONTLINE']);
  assert.deepEqual(hunter.rewardScopes, ['RANGED']);
  assert.equal(byId.get('guard')!.definition.attackDamage, applyPercent(guard.definition.attackDamage, 14, 0));
  assert.equal(byId.get('hunter')!.definition.attackDamage, applyPercent(hunter.definition.attackDamage, 19, 0));
});

test('economy, base HP and recharge rewards use canonical additive chapter-one totals', () => {
  const baseline = applyPermanentRewardBattleEffects({
    ownedRewardIds: [],
    startingSupply: 500,
    playerBaseHp: 5000,
    playerUnitCap: 50,
    playerSlots: PLAYER_SLOTS,
    enemies: ENEMIES,
  });
  const output = applyPermanentRewardBattleEffects({
    ownedRewardIds: ['wind-badge', 'double-plank', 'rust-nail', 'dust-charm', 'charred-grain', 'gold-road-stone', 'black-banner', 'wagon-wheel', 'wall-shadow'],
    startingSupply: 500,
    playerBaseHp: 5000,
    playerUnitCap: 50,
    playerSlots: PLAYER_SLOTS,
    enemies: ENEMIES,
  });

  assert.equal(output.startingSupply, applyPercent(500, 10, 0));
  assert.equal(output.playerBaseHp, applyPercent(5000, 10));
  assert.equal(output.enemies[0]!.rewardSupply, applyPercent(ENEMIES[0]!.rewardSupply, 8, 0));
  assert.equal(output.supplyLevels[1]!.upgradeCost, applyPercent(baseline.supplyLevels[1]!.upgradeCost, -3, 0));
  assert.equal(output.playerUnitCap, 50);

  for (let index = 0; index < PLAYER_SLOTS.length; index += 1) {
    const original = PLAYER_SLOTS[index]!;
    const rewarded = output.playerSlots[index]!;
    assert.equal(rewarded.rechargeFrames, Math.max(60, applyPercent(original.rechargeFrames, -4, 60)));
  }
});

test('permanent rewards never change movement, standing range, attack range, knockback, or deployment cap', () => {
  const output = applyPermanentRewardBattleEffects({
    ownedRewardIds: PERMANENT_REWARDS.map((reward) => reward.id),
    startingSupply: 500,
    playerBaseHp: 5000,
    playerUnitCap: 37,
    playerSlots: PLAYER_SLOTS,
    enemies: ENEMIES,
  });
  assert.equal(output.playerUnitCap, 37);
  for (let index = 0; index < PLAYER_SLOTS.length; index += 1) {
    const original = PLAYER_SLOTS[index]!;
    const rewarded = output.playerSlots[index]!;
    assert.equal(rewarded.definition.moveSpeed, original.definition.moveSpeed);
    assert.equal(rewarded.definition.standingRange, original.definition.standingRange);
    assert.equal(rewarded.definition.attackMinRange, original.definition.attackMinRange);
    assert.equal(rewarded.definition.attackMaxRange, original.definition.attackMaxRange);
    assert.equal(rewarded.definition.naturalKnockbackFrames, original.definition.naturalKnockbackFrames);
    assert.equal(rewarded.definition.naturalKnockbackDistance, original.definition.naturalKnockbackDistance);
  }
});

test('chapter-one final reward carries completion only, not an extra permanent combat stat', () => {
  const finalReward = PERMANENT_REWARDS.find((reward) => reward.id === 'border-crown')!;
  assert.deepEqual(finalReward.modifiers, [{ kind: 'CHAPTER_FLAG', flag: 'chapter-01-complete' }]);

  const output = applyPermanentRewardBattleEffects({
    ownedRewardIds: ['border-crown'],
    startingSupply: 500,
    playerBaseHp: 5000,
    playerSlots: PLAYER_SLOTS,
    enemies: ENEMIES,
  });
  assert.deepEqual(output.chapterFlags, ['chapter-01-complete']);
  assert.equal(output.startingSupply, 500);
  assert.equal(output.playerBaseHp, 5000);
});
