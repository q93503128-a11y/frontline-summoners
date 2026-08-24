import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHARACTER_LEVEL_CURVE,
  EVOLUTION_FORMS,
  applyCharacterLevel,
  applyEvolutionForm,
  buildCharacterCombatSlot,
  getCharacterLevelMultiplierPermille,
  getEvolutionForms,
} from '../src/character-growth.ts';
import { getSlotById } from '../src/prototype.ts';

test('prototype level curve is Lv1-50 with a softer slope after Lv30', () => {
  assert.equal(CHARACTER_LEVEL_CURVE.levelCap, 50);
  assert.equal(CHARACTER_LEVEL_CURVE.softCapLevel, 30);
  assert.equal(getCharacterLevelMultiplierPermille(1), 1000);
  assert.equal(getCharacterLevelMultiplierPermille(30), 1435);
  assert.equal(getCharacterLevelMultiplierPermille(50), 1595);
  assert.equal(getCharacterLevelMultiplierPermille(999), 1595);
});

test('level growth changes HP and base attack only, preserving identity stats such as range, cost and recharge', () => {
  const slot = getSlotById('turnip-rider')!;
  const leveled = applyCharacterLevel(slot, 30);
  assert.ok(leveled.definition.maxHp > slot.definition.maxHp);
  assert.ok(leveled.definition.attackDamage > slot.definition.attackDamage);
  assert.equal(leveled.definition.standingRange, slot.definition.standingRange);
  assert.equal(leveled.definition.attackMinRange, slot.definition.attackMinRange);
  assert.equal(leveled.definition.attackMaxRange, slot.definition.attackMaxRange);
  assert.equal(leveled.cost, slot.cost);
  assert.equal(leveled.rechargeFrames, slot.rechargeFrames);
});

test('first evolution slice gives C/B/A/S/SS examples exactly three selectable forms each', () => {
  const characters = ['turnip-rider', 'lantern-witch', 'clockwork-duck', 'mirror-exorcist', 'moon-eater'];
  assert.equal(EVOLUTION_FORMS.length, 15);
  for (const characterId of characters) {
    const forms = getEvolutionForms(characterId);
    assert.equal(forms.length, 3);
    assert.deepEqual(forms.map((form) => form.formOrder), [1, 2, 3]);
  }
});

test('turnip evolution is a real sidegrade: cheap rush form versus expensive area form, and the base form remains selectable', () => {
  const base = getSlotById('turnip-rider')!;
  const rush = applyEvolutionForm(base, 'turnip-rider-rush');
  const king = applyEvolutionForm(base, 'turnip-rider-king');
  const restoredBase = applyEvolutionForm(base, 'turnip-rider-base');

  assert.ok(rush.cost < base.cost);
  assert.ok(rush.rechargeFrames < base.rechargeFrames);
  assert.equal(rush.definition.targetMode, 'SINGLE');
  assert.ok(king.cost > base.cost);
  assert.equal(king.definition.targetMode, 'AREA');
  assert.deepEqual(restoredBase, base);
});

test('higher forms can change specialist identity instead of being pure stat upgrades', () => {
  const mirror = getSlotById('mirror-exorcist')!;
  const deep = applyEvolutionForm(mirror, 'mirror-exorcist-deep');
  const war = applyEvolutionForm(mirror, 'mirror-exorcist-war');
  assert.ok(deep.definition.standingRange > mirror.definition.standingRange);
  assert.ok(war.definition.standingRange < mirror.definition.standingRange);
  assert.equal(deep.definition.damageBonuses?.[0]?.trait, 'ARCANE');
  assert.equal(war.definition.damageBonuses?.[0]?.trait, 'BOSS');
});

test('level and form compose into one deterministic combat slot', () => {
  const moon = getSlotById('moon-eater')!;
  const evolved = buildCharacterCombatSlot(moon, 30, 'moon-eater-eclipse');
  assert.ok(evolved.definition.maxHp > moon.definition.maxHp);
  assert.ok(evolved.definition.attackDamage > moon.definition.attackDamage);
  assert.equal(evolved.definition.damageBonuses?.[0]?.trait, 'BOSS');
  assert.equal(evolved.definition.damageBonuses?.[0]?.multiplierPermille, 1700);
});
