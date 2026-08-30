import assert from 'node:assert/strict';
import test from 'node:test';
import { PERIODIC_REWARD_RECHARGE_MS } from '@frontline/sim/periodic-special';
import {
  getPeriodicSpecialChargeMap,
  getSpecialResourceReward,
  resetPeriodicSpecialChargeStateForTests,
} from '../src/special-rewards.ts';

const NOW = Date.parse('2026-08-30T12:00:00+09:00');

test('periodic first clear uses authored first reward and does not consume collection charge', () => {
  resetPeriodicSpecialChargeStateForTests();
  assert.deepEqual(getSpecialResourceReward('special_gold_convoy_01', true, NOW), { gold: 600, sweep_ticket: 1 });
  assert.equal(getPeriodicSpecialChargeMap(NOW).special_gold_convoy.charges, 4);
});

test('periodic repeats consume shared collection charge, remain playable depleted and recover after twelve hours', () => {
  resetPeriodicSpecialChargeStateForTests();
  for (let index = 0; index < 4; index += 1) {
    assert.deepEqual(getSpecialResourceReward('special_gold_convoy_01', false, NOW), { gold: 450 });
  }
  assert.equal(getPeriodicSpecialChargeMap(NOW).special_gold_convoy.charges, 0);
  assert.deepEqual(getSpecialResourceReward('special_gold_convoy_02', false, NOW), { gold: 170 }, 'charge is shared by the whole collection and zero charge still gives depleted reward');
  assert.deepEqual(getSpecialResourceReward('special_gold_convoy_02', false, NOW + PERIODIC_REWARD_RECHARGE_MS), { gold: 850 });
  assert.equal(getPeriodicSpecialChargeMap(NOW + PERIODIC_REWARD_RECHARGE_MS).special_gold_convoy.charges, 0);
});

test('the four periodic collections keep independent charge pools', () => {
  resetPeriodicSpecialChargeStateForTests();
  assert.deepEqual(getSpecialResourceReward('special_soul_forge_01', false, NOW), { soul_essence: 18 });
  assert.equal(getPeriodicSpecialChargeMap(NOW).special_soul_forge.charges, 3);
  assert.equal(getPeriodicSpecialChargeMap(NOW).special_gold_convoy.charges, 4);
});
