import assert from 'node:assert/strict';
import test from 'node:test';
import { applyEvolutionForm, getEvolutionForms } from '../src/character-growth.ts';
import { ENEMIES, PLAYER_SLOTS, getSlotById } from '../src/prototype.ts';

const storyTargets = [
  ['militia', '징집병', 60, 20, 50, 90, 3.0, 85, 0, 85, 40, 2, 'SINGLE'],
  ['guard', '방벽기사', 300, 20, 110, 180, 1.2, 70, 0, 70, 75, 1, 'SINGLE'],
  ['hunter', '수렵창병', 110, 55, 150, 210, 2.4, 205, 175, 235, 50, 3, 'SINGLE'],
  ['duelist', '결투검사', 140, 45, 180, 240, 3.2, 100, 0, 100, 28, 4, 'SINGLE'],
  ['lancer', '청창대', 250, 65, 250, 300, 2.0, 185, 0, 185, 60, 3, 'SINGLE'],
  ['battlemage', '전투마도사', 150, 90, 300, 360, 1.7, 255, 0, 300, 70, 3, 'AREA'],
  ['pyromancer', '화염술사', 160, 180, 450, 510, 1.5, 290, 180, 350, 105, 3, 'AREA'],
  ['royal', '왕실기사', 500, 130, 550, 600, 1.8, 140, 0, 140, 75, 2, 'AREA'],
  ['heretic', '이단주술사', 140, 220, 650, 750, 1.3, 420, 300, 500, 110, 4, 'AREA'],
  ['voidsage', '공허현자', 300, 500, 1000, 1200, 1.1, 430, 280, 520, 150, 3, 'AREA'],
] as const;

test('story F1 runtime now matches the authored v1 combat targets', () => {
  assert.equal(PLAYER_SLOTS.length, 10);
  for (const [id, name, hp, attack, cost, recharge, move, standing, min, max, cycle, kb, targetMode] of storyTargets) {
    const slot = getSlotById(id)!;
    assert.equal(slot.displayName, name, id);
    assert.equal(slot.definition.maxHp, hp, `${id}:hp`);
    assert.equal(slot.definition.attackDamage, attack, `${id}:attack`);
    assert.equal(slot.cost, cost, `${id}:cost`);
    assert.equal(slot.rechargeFrames, recharge, `${id}:recharge`);
    assert.equal(slot.definition.moveSpeed, move, `${id}:move`);
    assert.equal(slot.definition.standingRange, standing, `${id}:standing`);
    assert.equal(slot.definition.attackMinRange, min, `${id}:min`);
    assert.equal(slot.definition.attackMaxRange, max, `${id}:max`);
    assert.equal(slot.definition.attackTiming.cycleFrames, cycle, `${id}:cycle`);
    assert.equal(slot.definition.naturalKnockbackCount, kb, `${id}:kb`);
    assert.equal(slot.definition.targetMode, targetMode, `${id}:targetMode`);
  }
  assert.deepEqual(getSlotById('hunter')!.definition.damageBonuses, [
    { targetKind: 'ATTRIBUTE', target: 'BEAST', multiplierPermille: 1500 },
  ]);
  assert.deepEqual(getSlotById('battlemage')!.definition.attributes, ['NEUTRAL']);
  assert.deepEqual(getSlotById('pyromancer')!.definition.damageBonuses, [
    { targetKind: 'ATTRIBUTE', target: 'NATURE', multiplierPermille: 1500 },
  ]);
  assert.deepEqual(getSlotById('voidsage')!.definition.attributes, ['ANOMALY']);
  assert.deepEqual(getSlotById('voidsage')!.definition.damageBonuses, []);
});

const formTargets = {
  militia: [
    ['정규보병', 82, 28, 65, 96, 2.8, 95, 0, 95, 42, 2, 'SINGLE'],
    ['노련한 전선병', 68, 42, 72, 105, 3.2, 100, 0, 100, 34, 3, 'SINGLE'],
  ],
  guard: [
    ['성문수비대', 430, 24, 145, 210, 1.0, 72, 0, 72, 82, 1, 'SINGLE'],
    ['이동 성벽', 600, 15, 180, 240, 0.8, 65, 0, 65, 100, 1, 'SINGLE'],
  ],
  hunter: [
    ['큰짐승 사냥꾼', 130, 75, 180, 240, 2.2, 230, 195, 270, 58, 3, 'SINGLE'],
    ['왕실 수렵대', 118, 95, 220, 270, 2.3, 255, 215, 300, 62, 4, 'SINGLE'],
  ],
  duelist: [
    ['검무가', 160, 55, 215, 270, 3.4, 105, 0, 105, 24, 5, 'SINGLE'],
    ['일섬검객', 120, 110, 230, 300, 3.6, 125, 0, 125, 48, 5, 'SINGLE'],
  ],
  lancer: [
    ['장창방진', 330, 70, 300, 345, 1.5, 235, 0, 235, 68, 2, 'SINGLE'],
    ['파진창대', 225, 115, 330, 360, 2.4, 210, 0, 210, 58, 4, 'AREA'],
  ],
  battlemage: [
    ['전선술사', 180, 110, 350, 390, 1.6, 275, 0, 325, 66, 3, 'AREA'],
    ['포격마도사', 135, 190, 430, 480, 1.4, 330, 220, 390, 105, 4, 'AREA'],
  ],
  pyromancer: [
    ['화로지기', 230, 220, 510, 570, 1.2, 245, 120, 320, 115, 2, 'AREA'],
    ['재앙의 화염술사', 140, 350, 620, 690, 1.3, 355, 230, 450, 140, 4, 'AREA'],
  ],
  royal: [
    ['근위대장', 700, 145, 640, 690, 1.6, 145, 0, 145, 82, 2, 'AREA'],
    ['왕의 검', 440, 235, 680, 720, 2.0, 175, 0, 175, 62, 3, 'AREA'],
  ],
  heretic: [
    ['금단의 의식자', 155, 300, 760, 840, 1.1, 465, 330, 560, 130, 4, 'AREA'],
    ['역주술사', 185, 190, 690, 780, 1.6, 315, 210, 390, 72, 5, 'AREA'],
  ],
  voidsage: [
    ['틈새의 현자', 340, 650, 1100, 1320, 1.0, 460, 300, 560, 165, 3, 'AREA'],
    ['공허를 본 자', 265, 900, 1250, 1500, 0.9, 490, 310, 620, 190, 4, 'AREA'],
  ],
} as const;

test('all twenty paid story evolution forms use explicit authored combat identities', () => {
  for (const [id, targets] of Object.entries(formTargets)) {
    const base = getSlotById(id)!;
    const forms = getEvolutionForms(id);
    assert.equal(forms.length, 3);
    targets.forEach((target, targetIndex) => {
      const [name, hp, attack, cost, recharge, move, standing, min, max, cycle, kb, targetMode] = target;
      const form = forms[targetIndex + 1]!;
      const evolved = applyEvolutionForm(base, form.formId);
      assert.equal(form.name, name, `${id}:name`);
      assert.equal(evolved.definition.maxHp, hp, `${id}:hp`);
      assert.equal(evolved.definition.attackDamage, attack, `${id}:attack`);
      assert.equal(evolved.cost, cost, `${id}:cost`);
      assert.equal(evolved.rechargeFrames, recharge, `${id}:recharge`);
      assert.ok(Math.abs(evolved.definition.moveSpeed - move) < 1e-9, `${id}:move`);
      assert.equal(evolved.definition.standingRange, standing, `${id}:standing`);
      assert.equal(evolved.definition.attackMinRange, min, `${id}:min`);
      assert.equal(evolved.definition.attackMaxRange, max, `${id}:max`);
      assert.equal(evolved.definition.attackTiming.cycleFrames, cycle, `${id}:cycle`);
      assert.equal(evolved.definition.naturalKnockbackCount, kb, `${id}:kb`);
      assert.equal(evolved.definition.targetMode, targetMode, `${id}:targetMode`);
    });
  }
  assert.equal(applyEvolutionForm(getSlotById('duelist')!, 'duelist_f3').definition.attackTiming.hitFrames[0], 8);
});

test('chapter one execution layer contains only NEUTRAL and BEAST identity with authored boss targets', () => {
  const chapterOneIds = new Set([
    'enemy-raider','enemy-sprinter','enemy-spearman','enemy-shield','enemy-cultist',
    'enemy-sniper','enemy-knight','enemy-berserker','enemy-boss','enemy-boss-iron',
  ]);
  const chapterOne = ENEMIES.filter((enemy) => chapterOneIds.has(enemy.enemyId));
  assert.equal(chapterOne.length, 10);
  assert.deepEqual(new Set(chapterOne.flatMap((enemy) => enemy.definition.attributes ?? [])), new Set(['NEUTRAL','BEAST']));
  assert.equal(chapterOne.find((enemy) => enemy.enemyId === 'enemy-sprinter')?.displayName, '달림개');
  assert.deepEqual(chapterOne.find((enemy) => enemy.enemyId === 'enemy-sprinter')?.definition.attributes, ['BEAST']);
  assert.equal(chapterOne.find((enemy) => enemy.enemyId === 'enemy-knight')?.displayName, '굴렁통 멧돼지');
  assert.deepEqual(chapterOne.find((enemy) => enemy.enemyId === 'enemy-knight')?.definition.combatTags, ['ARMORED']);
  const golden = chapterOne.find((enemy) => enemy.enemyId === 'enemy-boss')!;
  assert.equal(golden.displayName, '황금가면 사령술사');
  assert.equal(golden.definition.maxHp, 2600);
  assert.equal(golden.definition.attackDamage, 180);
  assert.equal(golden.definition.standingRange, 365);
  assert.deepEqual(golden.definition.attributes, ['NEUTRAL']);
  const iron = chapterOne.find((enemy) => enemy.enemyId === 'enemy-boss-iron')!;
  assert.equal(iron.definition.maxHp, 5200);
  assert.equal(iron.definition.attackDamage, 260);
  assert.deepEqual(iron.definition.combatTags, ['ARMORED','BOSS']);
});
