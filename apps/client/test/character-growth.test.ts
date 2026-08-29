import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHARACTER_LEVEL_CURVE,
  EVOLUTION_FORMS,
  EVOLUTION_RECIPES,
  applyCharacterLevel,
  applyEvolutionForm,
  buildCharacterCombatSlot,
  getCharacterLevelMultiplierPermille,
  getCharacterTotalMultiplierPermille,
  getEvolutionForms,
  getEvolutionRecipe,
} from '../src/character-growth.ts';
import { ALL_PLAYER_SLOTS, getSlotById } from '../src/prototype.ts';
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

test('+levels apply multiplicatively at +2% per level and clamp at +50', () => {
  assert.equal(CHARACTER_LEVEL_CURVE.plusHpAttackPermillePerLevel, 20);
  assert.equal(getCharacterTotalMultiplierPermille(10, 10), 2280);
  assert.equal(getCharacterTotalMultiplierPermille(20, 20), 4550);
  assert.equal(getCharacterTotalMultiplierPermille(30, 30), 8000);
  assert.equal(getCharacterTotalMultiplierPermille(40, 40), 13050);
  assert.equal(getCharacterTotalMultiplierPermille(50, 50), 20000);
});

test('level and plus growth change HP and base attack only, preserving identity stats', () => {
  const slot = getSlotById('char_common_c_turnip_rider')!;
  const leveled = applyCharacterLevel(slot, 30, 10);
  assert.equal(leveled.definition.maxHp, 450);
  assert.equal(leveled.definition.attackDamage, 150);
  assert.equal(leveled.definition.standingRange, slot.definition.standingRange);
  assert.equal(leveled.cost, slot.cost);
  assert.equal(leveled.rechargeFrames, slot.rechargeFrames);
});

test('canonical v1 evolution catalog covers all 43 characters with exactly three selectable forms', () => {
  assert.equal(ALL_PLAYER_SLOTS.length, 43);
  assert.equal(EVOLUTION_FORMS.length, 129);
  assert.equal(EVOLUTION_RECIPES.length, 86);
  for (const slot of ALL_PLAYER_SLOTS) {
    const forms = getEvolutionForms(slot.slotId);
    assert.equal(forms.length, 3, slot.slotId);
    assert.deepEqual(forms.map((form) => form.formOrder), [1, 2, 3]);
    const f2 = getEvolutionRecipe(forms[1]!.formId);
    const f3 = getEvolutionRecipe(forms[2]!.formId);
    assert.equal(f2.requiredBaseLevel, 10);
    assert.equal(f3.requiredBaseLevel, 30);
    assert.ok(f2.cost.gold > 0 && f2.cost.evo_fragment > 0);
    assert.ok(f3.cost.gold > f2.cost.gold && f3.cost.evo_fragment > f2.cost.evo_fragment);
  }
});

test('turnip explicit forms remain sidegrades and never breach the two-second recharge floor', () => {
  const base = getSlotById('char_common_c_turnip_rider')!;
  const sturdy = applyEvolutionForm(base, 'char_common_c_turnip_rider_f2');
  const king = applyEvolutionForm(base, 'char_common_c_turnip_rider_f3');
  const restoredBase = applyEvolutionForm(base, 'char_common_c_turnip_rider_f1');
  assert.ok(sturdy.definition.maxHp > base.definition.maxHp);
  assert.ok(sturdy.definition.moveSpeed < base.definition.moveSpeed);
  assert.ok(sturdy.rechargeFrames >= MIN_PLAYER_RECHARGE_FRAMES);
  assert.ok(king.definition.attackDamage > sturdy.definition.attackDamage);
  assert.ok(king.cost > base.cost);
  assert.ok(king.rechargeFrames >= MIN_PLAYER_RECHARGE_FRAMES);
  assert.deepEqual(restoredBase, base);
});

test('higher forms can move attack geometry enough to change battlefield role', () => {
  const meteor = getSlotById('char_common_a_meteor_cart')!;
  const orbital = applyEvolutionForm(meteor, 'char_common_a_meteor_cart_f3');
  assert.ok(orbital.definition.standingRange > meteor.definition.standingRange);
  assert.ok(orbital.definition.attackMinRange > meteor.definition.attackMinRange);
  assert.ok(orbital.definition.attackMaxRange > meteor.definition.attackMaxRange);
  const mireille = getSlotById('char_s01_mireille')!;
  const zenith = applyEvolutionForm(mireille, 'char_s01_mireille_f3');
  assert.ok(zenith.definition.standingRange > mireille.definition.standingRange);
  assert.ok(zenith.definition.attackDamage > mireille.definition.attackDamage);
  assert.ok(zenith.definition.maxHp < mireille.definition.maxHp);
});

test('level, +level and form compose into one deterministic combat slot', () => {
  const base = getSlotById('char_s01_mireille')!;
  const evolved = buildCharacterCombatSlot(base, 30, 'char_s01_mireille_f3', 10);
  assert.ok(evolved.definition.maxHp > base.definition.maxHp);
  assert.ok(evolved.definition.attackDamage > base.definition.attackDamage);
  assert.ok(evolved.definition.standingRange > base.definition.standingRange);
  assert.ok(evolved.rechargeFrames >= MIN_PLAYER_RECHARGE_FRAMES);
});
