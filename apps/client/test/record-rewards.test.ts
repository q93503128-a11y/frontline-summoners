import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOSS_RUSH_REWARD_CAP_DEFEATED,
  ENDLESS_RECORD_REWARD_CAP_MINUTE,
  getBossRushMilestoneReward,
  getEndlessRecordMilestoneReward,
} from '../src/record-rewards.ts';

test('endless record rewards accumulate only newly crossed minute boundaries', () => {
  assert.deepEqual(getEndlessRecordMilestoneReward(0, 1), { gold: 800 });
  assert.deepEqual(getEndlessRecordMilestoneReward(1, 3), { gold: 2800, sweep_ticket: 1, evo_fragment: 2 });
  assert.deepEqual(getEndlessRecordMilestoneReward(3, 3), {});
});

test('endless record growth rewards stop at the explicit v1 resource cap', () => {
  assert.equal(ENDLESS_RECORD_REWARD_CAP_MINUTE, 20);
  assert.deepEqual(getEndlessRecordMilestoneReward(20, 99), {});
});

test('boss rush rewards accumulate each newly defeated boss and cap at the nine-boss runtime', () => {
  assert.equal(BOSS_RUSH_REWARD_CAP_DEFEATED, 9);
  assert.deepEqual(getBossRushMilestoneReward(0, 2), { gold: 4000 });
  assert.deepEqual(getBossRushMilestoneReward(4, 6), { summon_crystal: 175, soul_essence: 60 });
  assert.deepEqual(getBossRushMilestoneReward(9, 99), {});
});
