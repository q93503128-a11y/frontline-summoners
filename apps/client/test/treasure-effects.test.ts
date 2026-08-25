import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENEMIES,
  PLAYER_SLOTS,
  STAGES,
  createPrototypeBattle,
  getTreasureIdsForClearedStages,
  getUnlockedSlotIds,
} from '../src/prototype.ts';
import {
  TREASURE_EFFECTS,
  applyIntegerPercent,
  applyTreasureBattleEffects,
} from '../src/treasure-effects.ts';

test('every chapter-one stage treasure has exactly one typed effect definition', () => {
  const stageIds = STAGES.map((stage) => stage.treasure.id).sort();
  const effectIds = TREASURE_EFFECTS.map((effect) => effect.id).sort();
  assert.deepEqual(effectIds, stageIds);
  assert.equal(new Set(effectIds).size, 20);
});

test('cleared stage ids resolve to the exact owned treasure ids without inventing rewards', () => {
  const cleared = [STAGES[0]!.id, STAGES[2]!.id, STAGES[4]!.id];
  assert.deepEqual(
    getTreasureIdsForClearedStages(cleared),
    [STAGES[0]!.treasure.id, STAGES[2]!.treasure.id, STAGES[4]!.treasure.id],
  );
});

test('treasure modifiers affect the actual playable battle configuration', () => {
  const stage = STAGES[1]!;
  const unlocked = getUnlockedSlotIds([STAGES[0]!.id]);
  const noTreasure = createPrototypeBattle(stage.id, unlocked, []);
  const withWindBadge = createPrototypeBattle(stage.id, unlocked, ['wind-badge']);

  assert.equal(noTreasure.supply, stage.startingSupply);
  assert.equal(withWindBadge.supply, applyIntegerPercent(stage.startingSupply, 6, 0));
  assert.notEqual(noTreasure.stateHash, withWindBadge.stateHash, 'owned permanent progression must be part of future battle identity');
});

test('base HP, kill reward and upgrade-cost treasures change deterministic config while deployment cap remains a stage rule', () => {
  const commonInput = {
    startingSupply: 500,
    playerBaseHp: 5000,
    playerUnitCap: 50,
    playerSlots: PLAYER_SLOTS,
    enemies: ENEMIES,
  } as const;
  const baseline = applyTreasureBattleEffects({ ...commonInput, ownedTreasureIds: [] });
  const output = applyTreasureBattleEffects({
    ...commonInput,
    ownedTreasureIds: ['rust-nail', 'black-banner', 'charred-grain', 'gold-road-stone'],
  });

  assert.equal(output.playerBaseHp, applyIntegerPercent(5000, 6));
  assert.equal(output.playerUnitCap, 50);
  assert.equal(output.enemies[0]!.rewardSupply, applyIntegerPercent(ENEMIES[0]!.rewardSupply, 6, 0));
  assert.ok(output.supplyLevels[1]!.upgradeCost < baseline.supplyLevels[1]!.upgradeCost);
});

test('unit-targeted treasures apply only to matching roster roles, attributes and ids', () => {
  const output = applyTreasureBattleEffects({
    ownedTreasureIds: ['pot-token', 'double-plank', 'mask-thread', 'fallen-crest'],
    startingSupply: 500,
    playerBaseHp: 5000,
    playerSlots: PLAYER_SLOTS,
    enemies: ENEMIES,
  });
  const byId = new Map(output.playerSlots.map((slot) => [slot.slotId, slot]));

  const originalGuard = PLAYER_SLOTS.find((slot) => slot.slotId === 'guard')!;
  const boostedGuard = byId.get('guard')!;
  assert.ok(boostedGuard.definition.maxHp > originalGuard.definition.maxHp, 'guard receives role HP and guard-specific HP progression');
  assert.ok(boostedGuard.definition.attackDamage > originalGuard.definition.attackDamage, 'melee treasure affects attackMinRange=0 units');

  const originalMage = PLAYER_SLOTS.find((slot) => slot.slotId === 'battlemage')!;
  const boostedMage = byId.get('battlemage')!;
  assert.ok(boostedMage.definition.maxHp > originalMage.definition.maxHp, 'ARCANE attribute HP treasure affects arcane units');

  const originalHunter = PLAYER_SLOTS.find((slot) => slot.slotId === 'hunter')!;
  const boostedHunter = byId.get('hunter')!;
  assert.equal(boostedHunter.definition.maxHp, originalHunter.definition.maxHp, 'unmatched role/attribute HP bonuses must not leak to hunter');
});

test('chapter treasure growth no longer changes movement, knockback timing, or deployment cap', () => {
  const output = applyTreasureBattleEffects({
    ownedTreasureIds: ['barefoot-ribbon', 'wagon-wheel', 'dust-charm'],
    startingSupply: 500,
    playerBaseHp: 5000,
    playerUnitCap: 50,
    playerSlots: PLAYER_SLOTS,
    enemies: ENEMIES,
  });
  const byId = new Map(output.playerSlots.map((slot) => [slot.slotId, slot]));

  const militia = PLAYER_SLOTS.find((slot) => slot.slotId === 'militia')!;
  const boostedMilitia = byId.get('militia')!;
  assert.ok(boostedMilitia.definition.maxHp > militia.definition.maxHp, 'frontline and universal HP treasures stack on militia');
  assert.equal(boostedMilitia.definition.moveSpeed, militia.definition.moveSpeed);
  assert.equal(boostedMilitia.definition.naturalKnockbackFrames, militia.definition.naturalKnockbackFrames);
  assert.equal(boostedMilitia.rechargeFrames, applyIntegerPercent(militia.rechargeFrames, -4));
  assert.equal(output.playerUnitCap, 50);

  const hunter = PLAYER_SLOTS.find((slot) => slot.slotId === 'hunter')!;
  const boostedHunter = byId.get('hunter')!;
  assert.ok(boostedHunter.definition.maxHp > hunter.definition.maxHp, 'universal HP treasure still affects hunter');
  assert.equal(boostedHunter.definition.moveSpeed, hunter.definition.moveSpeed);
  assert.equal(boostedHunter.definition.naturalKnockbackFrames, hunter.definition.naturalKnockbackFrames);
  assert.equal(boostedHunter.rechargeFrames, applyIntegerPercent(hunter.rechargeFrames, -4));
});

test('integer percentage progression is deterministic for larger integer stats', () => {
  assert.equal(applyIntegerPercent(500, 6), 530);
  assert.equal(applyIntegerPercent(500, -6), 470);
  assert.equal(applyIntegerPercent(0, 10, 0), 0);
});
