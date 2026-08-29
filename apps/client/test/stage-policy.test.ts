import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_STAGES, SPECIAL_STAGES, STAGES, getStage } from '../src/prototype.ts';

const CHAPTER_ONE_STAGES = STAGES.slice(0, 20);
const CHAPTER_TWO_STAGES = STAGES.slice(20, 40);
const CHAPTER_THREE_STAGES = STAGES.slice(40, 60);
const CHAPTER_FOUR_STAGES = STAGES.slice(60, 80);

function assertScaling(stages: readonly (typeof ALL_STAGES)[number][], expected: { enemyHpPermille: number; enemyAttackPermille: number; enemyBaseHpPermille: number }): void {
  for (const stage of stages) assert.deepEqual(stage.coopStatScaling, expected, `unexpected co-op scaling for ${stage.id}`);
}

test('typed stage policy metadata is merged into all eighty main and sixty-one SPECIAL stages', () => {
  assert.equal(STAGES.length, 80);
  assert.equal(SPECIAL_STAGES.length, 61);
  assert.equal(ALL_STAGES.length, 141);
  for (const stage of ALL_STAGES) {
    assert.ok(['SOLO_ONLY', 'SOLO_OR_COOP', 'COOP_ONLY'].includes(stage.multiplayerPolicy));
    assert.ok(['NEVER', 'AFTER_NORMAL_CLEAR'].includes(stage.speedUpEligibility));
    assert.ok(['NEVER', 'AFTER_NORMAL_CLEAR'].includes(stage.sweepEligibility));
    assert.ok(['NONE', 'COLLECTION_CHARGE'].includes(stage.rewardChargePolicy));
    assert.equal(getStage(stage.id).multiplayerPolicy, stage.multiplayerPolicy);
  }
});

test('main chapters and SPECIAL collections retain authored co-op scaling bands', () => {
  assert.equal(CHAPTER_ONE_STAGES[0]!.multiplayerPolicy, 'SOLO_ONLY');
  assert.equal(CHAPTER_ONE_STAGES[1]!.multiplayerPolicy, 'SOLO_ONLY');
  assert.ok([...CHAPTER_TWO_STAGES, ...CHAPTER_THREE_STAGES, ...CHAPTER_FOUR_STAGES, ...SPECIAL_STAGES].every((stage) => stage.multiplayerPolicy === 'SOLO_OR_COOP'));
  assertScaling(CHAPTER_ONE_STAGES.slice(0, 2), { enemyHpPermille: 1000, enemyAttackPermille: 1000, enemyBaseHpPermille: 1000 });
  assert.deepEqual(getStage('special_five_banners_01').coopStatScaling, { enemyHpPermille: 1200, enemyAttackPermille: 1080, enemyBaseHpPermille: 1120 });
  assert.deepEqual(getStage('special_light_purse_02').coopStatScaling, { enemyHpPermille: 1200, enemyAttackPermille: 1100, enemyBaseHpPermille: 1120 });
  assert.deepEqual(getStage('event_summer_01_01').coopStatScaling, { enemyHpPermille: 1180, enemyAttackPermille: 1080, enemyBaseHpPermille: 1100 });
  assert.deepEqual(getStage('event_summer_01_06').coopStatScaling, { enemyHpPermille: 1220, enemyAttackPermille: 1100, enemyBaseHpPermille: 1120 });
  assert.deepEqual(getStage('event_zero_edge_01_05').coopStatScaling, { enemyHpPermille: 1220, enemyAttackPermille: 1100, enemyBaseHpPermille: 1120 });
  assert.deepEqual(getStage('special_anomaly_04').coopStatScaling, { enemyHpPermille: 1240, enemyAttackPermille: 1100, enemyBaseHpPermille: 1120 });
});

test('current non-record stages expose replay convenience only after NORMAL_CLEAR and do not fake reward charges', () => {
  for (const stage of ALL_STAGES) {
    assert.equal(stage.speedUpEligibility, 'AFTER_NORMAL_CLEAR');
    assert.equal(stage.sweepEligibility, 'AFTER_NORMAL_CLEAR');
    assert.equal(stage.rewardChargePolicy, 'NONE');
  }
});
