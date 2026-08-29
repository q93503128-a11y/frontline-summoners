import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_STAGES,
  PLAYER_SLOTS,
  SPECIAL_STAGES,
  STAGES,
  createPrototypeBattle,
  getPermanentRewardIdsForClearedStages,
  getSpecialStageNumber,
  getStage,
  isBattleStageUnlocked,
  isSpecialStageUnlocked,
} from '../src/prototype.ts';

const CHAPTER_ONE_STAGES = STAGES.slice(0, 20);

test('special content stays optional and separate from the two-chapter progression spine', () => {
  assert.equal(STAGES.length, 40);
  assert.ok(SPECIAL_STAGES.length > 0);
  assert.equal(ALL_STAGES.length, STAGES.length + SPECIAL_STAGES.length);
  assert.ok(SPECIAL_STAGES.every((stage) => stage.stageType === 'SPECIAL'));
  assert.ok(SPECIAL_STAGES.every((stage) => stage.unlockUnitId === undefined));
  assert.ok(SPECIAL_STAGES.every((stage) => stage.permanentRewardId === undefined));
  assert.equal(new Set(ALL_STAGES.map((stage) => stage.id)).size, ALL_STAGES.length);
});

test('the first special challenge stays locked until chapter one is cleared without entering progression order', () => {
  const firstSpecial = SPECIAL_STAGES[0]!;
  const nineteenClears = CHAPTER_ONE_STAGES.slice(0, 19).map((stage) => stage.id);
  const fullChapterOne = CHAPTER_ONE_STAGES.map((stage) => stage.id);

  assert.equal(isSpecialStageUnlocked(firstSpecial.id, nineteenClears), false);
  assert.equal(isBattleStageUnlocked(firstSpecial.id, nineteenClears), false);
  assert.equal(isSpecialStageUnlocked(firstSpecial.id, fullChapterOne), true);
  assert.equal(isBattleStageUnlocked(firstSpecial.id, fullChapterOne), true);
  assert.equal(getSpecialStageNumber(firstSpecial.id), 1);
  assert.equal(getStage(firstSpecial.id).id, firstSpecial.id);
});

test('special stages use valid challenge data without relying on obsolete flat wave fields', () => {
  for (const stage of SPECIAL_STAGES) {
    assert.ok(stage.difficulty >= 1 && stage.difficulty <= 12);
    assert.ok(stage.mapLength > 0);
    assert.ok(stage.playerUnitCap > 0);
    assert.ok(stage.enemyUnitCap > 0);
    assert.ok(stage.waves.length > 0);
    for (const wave of stage.waves) {
      assert.ok(wave.id.length > 0);
      assert.ok(wave.spawn.enemyId.length > 0);
      assert.ok(wave.spawn.count > 0);
      assert.ok(wave.spawn.intervalFrames > 0);
      assert.ok(wave.spawn.magnificationPermille >= 100);
    }
  }
});

test('special battle factory applies chapter-one permanent growth without changing stage unit caps', () => {
  const fullChapterOne = CHAPTER_ONE_STAGES.map((stage) => stage.id);
  const permanentRewardIds = getPermanentRewardIdsForClearedStages(fullChapterOne);
  const allSlots = PLAYER_SLOTS.map((slot) => slot.slotId);

  for (const stage of SPECIAL_STAGES) {
    const battle = createPrototypeBattle(stage.id, allSlots, permanentRewardIds);
    assert.equal(battle.playerUnitCap, stage.playerUnitCap, 'permanent rewards must not increase the deployment cap');
    assert.equal(battle.enemyUnitCap, stage.enemyUnitCap);
    assert.equal(battle.battle.mapLength, stage.mapLength);
    assert.equal(battle.playerSlots.length, PLAYER_SLOTS.length);
  }
});
