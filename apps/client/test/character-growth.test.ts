import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHARACTER_LEVEL_CURVE,
  EVOLUTION_FORMS,
  applyCharacterLevel,
  applyEvolutionForm,
  buildCharacterCombatSlot,
  getCharacterLevelMultiplierPermille,
  getCharacterTotalMultiplierPermille,
  getEvolutionForms,
} from '../src/character-growth.ts';
import { getSlotById } from '../src/prototype.ts';
import { MIN_PLAYER_RECHARGE_FRAMES } from '@frontline/sim/playable';

test('v1 level curve uses strong Lv1-50 anchor growth', () => {
  assert.equal(CHARACTER_LEVEL_CURVE.levelCap, 50);
  assert.equal(CHARACTER_LEVEL_CURVE.plusLevelCap, 50);
  assert.equal(getCharacterLevelMultiplierPermille(1), 1000);
  assert.equal(getCharacterLevelMultiplierPermille(10), 1900);
  assert.equal(getCharacterLevelMultiplierPermille(20), 3250);
  assert.equal(getCharacterLevelMultiplierPermille(30), 5000);
  assert.equal(getCharacterLevelMultiplierPermille(40), 7250);
  assert.equal(getCharacterLevelMultiplierPermille(50), 10000);
  assert.equal(getCharacterLevelMultiplierPermille(999), 10000);
});

test('+levels are meaningful late growth and clamp at +50', () => {
  assert.equal(CHARACTER_LEVEL_CURVE.plusHpAttackPermillePerLevel, 200);
  assert.equal(getCharacterTotalMultiplierPermille(50, 0), 10000);
  assert.equal(getCharacterTotalMultiplierPermille(50, 50), 20000);
  assert.equal(getCharacterTotalMultiplierPermille(50, 999), 20000);
});

test('level and plus growth change HP and base attack only, preserving identity stats', () => {
  const slot = getSlotById('turnip-rider')!;
  const leveled = applyCharacterLevel(slot, 30, 10);
  assert.ok(leveled.definition.maxHp > slot.definition.maxHp);
  assert.ok(leveled.definition.attackDamage > slot.definition.attackDamage);
  assert.equal(leveled.definition.standingRange, slot.definition.standingRange);
  assert.equal(leveled.definition.attackMinRange, slot.definition.attackMinRange);
  assert.equal(leveled.definition.attackMaxRange, slot.definition.attackMaxRange);
  assert.equal(leveled.cost, slot.cost);
  assert.equal(leveled.rechargeFrames, slot.rechargeFrames);
});

test('first evolution slice gives five examples exactly three selectable forms each', () => {
  const characters = ['turnip-rider', 'lantern-witch', 'clockwork-duck', 'mirror-exorcist', 'moon-eater'];
  assert.equal(EVOLUTION_FORMS.length, 15);
  for (const characterId of characters) {
    const forms = getEvolutionForms(characterId);
    assert.equal(forms.length, 3);
    assert.deepEqual(forms.map((form) => form.formOrder), [1, 2, 3]);
  }
});

test('turnip evolution remains a real sidegrade and never breaches the two-second recharge floor', () => {
  const base = getSlotById('turnip-rider')!;
  const rush = applyEvolutionForm(base, 'turnip-rider-rush');
  const king = applyEvolutionForm(base, 'turnip-rider-king');
  const restoredBase = applyEvolutionForm(base, 'turnip-rider-base');

  assert.ok(rush.cost < base.cost);
  assert.ok(rush.rechargeFrames <= base.rechargeFrames);
  assert.ok(rush.rechargeFrames >= MIN_PLAYER_RECHARGE_FRAMES);
  assert.equal(rush.definition.targetMode, 'SINGLE');
  assert.ok(king.cost > base.cost);
  assert.equal(king.definition.targetMode, 'AREA');
  assert.deepEqual(restoredBase, base);
});

test('higher forms can specialize against attributes or combat tags', () => {
  const mirror = getSlotById('mirror-exorcist')!;
  const deep = applyEvolutionForm(mirror, 'mirror-exorcist-deep');
  const war = applyEvolutionForm(mirror, 'mirror-exorcist-war');
  assert.ok(deep.definition.standingRange > mirror.definition.standingRange);
  assert.ok(war.definition.standingRange < mirror.definition.standingRange);
  assert.deepEqual(deep.definition.damageBonuses?.[0], { targetKind: 'ATTRIBUTE', target: 'ARCANE', multiplierPermille: 1500 });
  assert.deepEqual(war.definition.damageBonuses?.[0], { targetKind: 'TAG', target: 'BOSS', multiplierPermille: 1300 });
});

test('level, +level and form compose into one deterministic combat slot', () => {
  const moon = getSlotById('moon-eater')!;
  const evolved = buildCharacterCombatSlot(moon, 30, 'moon-eater-eclipse', 10);
  assert.ok(evolved.definition.maxHp > moon.definition.maxHp);
  assert.ok(evolved.definition.attackDamage > moon.definition.attackDamage);
  assert.equal(evolved.definition.damageBonuses?.[0]?.targetKind, 'TAG');
  assert.equal(evolved.definition.damageBonuses?.[0]?.target, 'BOSS');
  assert.equal(evolved.definition.damageBonuses?.[0]?.multiplierPermille, 1700);
  assert.ok(evolved.rechargeFrames >= MIN_PLAYER_RECHARGE_FRAMES);
});
