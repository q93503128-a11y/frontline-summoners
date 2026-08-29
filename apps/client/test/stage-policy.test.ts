import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_STAGES, SPECIAL_STAGES, STAGES, getStage } from '../src/prototype.ts';

const CHAPTER_ONE_STAGES = STAGES.slice(0, 20);
const CHAPTER_TWO_STAGES = STAGES.slice(20, 40);

test('typed stage policy metadata is merged into every runtime stage', () => {
  assert.equal(ALL_STAGES.length, 45);
  for (const stage of ALL_STAGES) {
    assert.ok(['SOLO_ONLY', 'SOLO_OR_COOP', 'COOP_ONLY'].includes(stage.multiplayerPolicy));
    assert.ok(['NEVER', 'AFTER_NORMAL_CLEAR'].includes(stage.speedUpEligibility));
    assert.ok(['NEVER', 'AFTER_NORMAL_CLEAR'].includes(stage.sweepEligibility));
    assert.ok(['NONE', 'COLLECTION_CHARGE'].includes(stage.rewardChargePolicy));
    assert.ok(stage.coopStatScaling.enemyHpPermille >= 100);
    assert.ok(stage.coopStatScaling.enemyAttackPermille >= 100);
    assert.ok(stage.coopStatScaling.enemyBaseHpPermille >= 100);
    assert.equal(getStage(stage.id).multiplayerPolicy, stage.multiplayerPolicy);
  }
});

test('chapter-one tutorials remain solo while chapter one, chapter two and SPECIAL use their authored coop scaling', () => {
  assert.equal(CHAPTER_ONE_STAGES[0]!.multiplayerPolicy, 'SOLO_ONLY');
  assert.equal(CHAPTER_ONE_STAGES[1]!.multiplayerPolicy, 'SOLO_ONLY');
  assert.ok(CHAPTER_ONE_STAGES.slice(2).every((stage) => stage.multiplayerPolicy === 'SOLO_OR_COOP'));
  assert.ok(CHAPTER_TWO_STAGES.every((stage) => stage.multiplayerPolicy === 'SOLO_OR_COOP'));
  assert.ok(SPECIAL_STAGES.every((stage) => stage.multiplayerPolicy === 'SOLO_OR_COOP'));

  for (const stage of CHAPTER_ONE_STAGES.slice(0, 2)) {
    assert.deepEqual(stage.coopStatScaling, {
      enemyHpPermille: 1000,
      enemyAttackPermille: 1000,
      enemyBaseHpPermille: 1000,
    });
  }
  for (const stage of [...CHAPTER_ONE_STAGES.slice(2), ...SPECIAL_STAGES]) {
    assert.deepEqual(stage.coopStatScaling, {
      enemyHpPermille: 1180,
      enemyAttackPermille: 1080,
      enemyBaseHpPermille: 1120,
    });
  }
  for (const stage of CHAPTER_TWO_STAGES.slice(0, -1)) {
    assert.deepEqual(stage.coopStatScaling, {
      enemyHpPermille: 1200,
      enemyAttackPermille: 1080,
      enemyBaseHpPermille: 1120,
    });
  }
  assert.deepEqual(CHAPTER_TWO_STAGES.at(-1)!.coopStatScaling, {
    enemyHpPermille: 1220,
    enemyAttackPermille: 1080,
    enemyBaseHpPermille: 1120,
  });
});

test('current non-record stages expose replay convenience only after NORMAL_CLEAR and do not fake reward charges', () => {
  for (const stage of ALL_STAGES) {
    assert.equal(stage.speedUpEligibility, 'AFTER_NORMAL_CLEAR');
    assert.equal(stage.sweepEligibility, 'AFTER_NORMAL_CLEAR');
    assert.equal(stage.rewardChargePolicy, 'NONE');
  }
});
