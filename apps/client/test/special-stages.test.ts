import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_STAGES,
  PLAYER_SLOTS,
  SPECIAL_STAGES,
  STAGES,
  createPrototypeBattle,
  getSpecialStageNumber,
  getStage,
  getTreasureIdsForClearedStages,
  isBattleStageUnlocked,
  isSpecialStageUnlocked,
} from '../src/prototype.ts';

test('first special pack adds five optional challenges without changing the 20-stage progression spine', () => {
  assert.equal(STAGES.length, 20);
  assert.equal(SPECIAL_STAGES.length, 5);
  assert.equal(ALL_STAGES.length, 25);
  assert.ok(SPECIAL_STAGES.every((stage) => stage.stageType === 'SPECIAL'));
  assert.ok(SPECIAL_STAGES.every((stage) => stage.unlockUnitId === undefined));
  assert.equal(new Set(ALL_STAGES.map((stage) => stage.id)).size, ALL_STAGES.length);
  assert.deepEqual(SPECIAL_STAGES.map((stage) => stage.difficulty), [6, 7, 8, 9, 10]);
});

test('special challenges stay locked until chapter one is cleared but never participate in progression order', () => {
  const firstSpecial = SPECIAL_STAGES[0]!;
  const nineteenClears = STAGES.slice(0, 19).map((stage) => stage.id);
  const fullChapter = STAGES.map((stage) => stage.id);

  assert.equal(isSpecialStageUnlocked(firstSpecial.id, nineteenClears), false);
  assert.equal(isBattleStageUnlocked(firstSpecial.id, nineteenClears), false);
  assert.equal(isSpecialStageUnlocked(firstSpecial.id, fullChapter), true);
  assert.equal(isBattleStageUnlocked(firstSpecial.id, fullChapter), true);
  assert.equal(getSpecialStageNumber(firstSpecial.id), 1);
  assert.equal(getStage(firstSpecial.id).id, firstSpecial.id);
});

test('special pack uses materially different battlefield pressures rather than five normal-stage copies', () => {
  const [threeSlot, rush, sniperLine, threeVow, doubleBoss] = SPECIAL_STAGES;
  assert.equal(threeSlot?.playerUnitCap, 2, 'chapter-one +1 cap treasure makes this an effective three-unit challenge');
  assert.equal(threeVow?.playerUnitCap, 2, 'chapter-one +1 cap treasure makes this an effective three-unit boss challenge');
  assert.equal(rush?.mapLength, 650);
  assert.equal(rush?.enemyUnitCap, 25);
  assert.equal(sniperLine?.mapLength, 1500);
  assert.equal(sniperLine?.waves.some((wave) => wave.enemyId === 'enemy-sniper' && wave.count >= 6), true);
  assert.deepEqual(
    doubleBoss?.waves.filter((wave) => wave.enemyId.startsWith('enemy-boss-')).map((wave) => wave.enemyId),
    ['enemy-boss-golden', 'enemy-boss-iron'],
  );
});

test('special battle factory applies all chapter-one account growth while respecting stage-specific caps', () => {
  const fullChapter = STAGES.map((stage) => stage.id);
  const chapterTreasures = getTreasureIdsForClearedStages(fullChapter);
  const allSlots = PLAYER_SLOTS.map((slot) => slot.slotId);

  const threeSlotBattle = createPrototypeBattle(SPECIAL_STAGES[0]!.id, allSlots, chapterTreasures);
  assert.equal(threeSlotBattle.playerUnitCap, 3);
  assert.equal(threeSlotBattle.enemyUnitCap, 18);
  assert.equal(threeSlotBattle.playerSlots.length, 10);

  const finalSpecialBattle = createPrototypeBattle(SPECIAL_STAGES[4]!.id, allSlots, chapterTreasures);
  assert.equal(finalSpecialBattle.playerUnitCap, 9);
  assert.equal(finalSpecialBattle.enemyUnitCap, 20);
  assert.equal(finalSpecialBattle.battle.mapLength, 1280);
});
