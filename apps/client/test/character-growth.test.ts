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

test('all fifteen common recruitment characters use their authored C/B/A evolution identities instead of role templates', () => {
  const expectedNames = new Map<string, readonly string[]>([
    ['char_common_c_turnip_rider', ['순무기수', '절임순무 기수', '왕순무 돌격대']],
    ['char_common_c_tin_squire', ['양철방패 시종', '냄비뚜껑 근위', '양철성벽대']],
    ['char_common_c_slinger', ['목동 투석수', '산등성이 투석수', '거석 투석꾼']],
    ['char_common_c_bell_crab', ['종껍질 게', '대종게', '종탑게']],
    ['char_common_c_lantern_moth', ['등불나방', '유도등나방', '월광등나방']],
    ['char_common_b_lantern_witch', ['등불마녀', '푸른등 마녀', '밤길 인도자']],
    ['char_common_b_clockduck', ['태엽오리기사', '장갑오리기사', '폭주 태엽오리']],
    ['char_common_b_coffin_merchant', ['관짝 장사꾼', '검은 장의사', '떠도는 영구차']],
    ['char_common_b_moss_golem', ['이끼골렘', '고목골렘', '이동정원']],
    ['char_common_b_ink_raven', ['먹물까마귀', '먹구름 까마귀', '검은 필경사']],
    ['char_common_a_glass_keeper', ['유리등대지기', '백광 등대지기', '움직이는 등대']],
    ['char_common_a_bonedrum', ['뼈북 악단장', '장송 악단장', '백골 대행진']],
    ['char_common_a_paper_dragon', ['접지 않은 종이용', '천마리 종이용', '서고를 삼킨 용']],
    ['char_common_a_meteor_cart', ['고철 운석차', '강철 운석차', '궤도 낙하포']],
    ['char_common_a_mirror_guide', ['거울길잡이', '파경술사', '천면경']],
  ]);
  assert.equal(expectedNames.size, 15);
  for (const [characterId, names] of expectedNames) {
    assert.deepEqual(getEvolutionForms(characterId).map((form) => form.name), names, characterId);
  }

  const wall = applyEvolutionForm(getSlotById('char_common_c_tin_squire')!, 'char_common_c_tin_squire_f3');
  assert.equal(wall.definition.maxHp, 300);
  assert.equal(wall.definition.attackDamage, 12);
  assert.equal(wall.cost, 90);
  assert.equal(wall.rechargeFrames, 150);
  assert.ok(Math.abs(wall.definition.moveSpeed - 1.4) < 1e-9);

  const slinger = applyEvolutionForm(getSlotById('char_common_c_slinger')!, 'char_common_c_slinger_f3');
  assert.equal(slinger.definition.standingRange, 365);
  assert.equal(slinger.definition.attackMinRange, 300);
  assert.equal(slinger.definition.attackMaxRange, 430);
  assert.equal(slinger.definition.attackTiming.cycleFrames, 120);

  const bone = applyEvolutionForm(getSlotById('char_common_a_bonedrum')!, 'char_common_a_bonedrum_f3');
  assert.equal(bone.definition.attackDamage, 66);
  assert.deepEqual(bone.definition.attackTiming.hitFrames, [18, 26, 34, 42, 50]);
  assert.equal(bone.definition.attackTiming.cycleFrames, 105);
  assert.equal(bone.definition.naturalKnockbackCount, 5);

  const paper = applyEvolutionForm(getSlotById('char_common_a_paper_dragon')!, 'char_common_a_paper_dragon_f2');
  assert.equal(paper.definition.attackDamage, 48);
  assert.deepEqual(paper.definition.attackTiming.hitFrames, [18, 24, 30, 36]);
  assert.equal(paper.definition.attackTiming.cycleFrames, 84);

  const orbital = applyEvolutionForm(getSlotById('char_common_a_meteor_cart')!, 'char_common_a_meteor_cart_f3');
  assert.equal(orbital.definition.maxHp, 650);
  assert.equal(orbital.definition.attackDamage, 900);
  assert.equal(orbital.definition.standingRange, 420);
  assert.equal(orbital.definition.attackMinRange, 300);
  assert.equal(orbital.definition.attackMaxRange, 560);
  assert.equal(orbital.definition.attackTiming.cycleFrames, 200);

  const mirror = applyEvolutionForm(getSlotById('char_common_a_mirror_guide')!, 'char_common_a_mirror_guide_f3');
  assert.equal(mirror.definition.attackDamage, 110);
  assert.deepEqual(mirror.definition.attackTiming.hitFrames, [24, 34, 44]);
  assert.equal(mirror.definition.attackTiming.cycleFrames, 115);
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
