import assert from 'node:assert/strict';
import test from 'node:test';
import { createFullPeriodicRewardChargeMap } from '../src/periodic-special.ts';
import {
  PERIODIC_SPECIAL_REWARDS,
  SPECIAL_RESOURCE_REWARDS,
  resolveSpecialResourceReward,
} from '../src/special-rewards.ts';

const NOW = Date.parse('2026-08-30T09:30:00+09:00');

test('SPECIAL reward ids stay unique across periodic and ordinary tables', () => {
  const ids = [...PERIODIC_SPECIAL_REWARDS, ...SPECIAL_RESOURCE_REWARDS].map((entry) => entry.stageId);
  assert.equal(PERIODIC_SPECIAL_REWARDS.length, 18);
  assert.equal(SPECIAL_RESOURCE_REWARDS.length, 38);
  assert.equal(new Set(ids).size, ids.length);
});

test('periodic first clear does not consume charge and repeat does', () => {
  const full = createFullPeriodicRewardChargeMap();
  const first = resolveSpecialResourceReward('special_gold_convoy_01', true, full, NOW);
  assert.deepEqual(first.resourceReward, { gold: 600, sweep_ticket: 1 });
  assert.equal(first.chargeConsumed, false);
  assert.equal(first.periodicChargeMap.special_gold_convoy.charges, 4);

  const repeat = resolveSpecialResourceReward('special_gold_convoy_01', false, first.periodicChargeMap, NOW);
  assert.deepEqual(repeat.resourceReward, { gold: 450 });
  assert.equal(repeat.chargeConsumed, true);
  assert.equal(repeat.periodicChargeMap.special_gold_convoy.charges, 3);
});

test('ordinary SPECIAL first clear combines repeat reward and first-clear bonus', () => {
  const resolved = resolveSpecialResourceReward('special_glutton_01', true, createFullPeriodicRewardChargeMap(), NOW);
  assert.deepEqual(resolved.resourceReward, { gold: 1000, evo_fragment: 2 });
  assert.equal(resolved.chargeConsumed, false);
});

test('unrewarded challenge SPECIAL resolves to no resource mutation', () => {
  const resolved = resolveSpecialResourceReward('special-01', true, createFullPeriodicRewardChargeMap(), NOW);
  assert.deepEqual(resolved.resourceReward, {});
  assert.equal(resolved.chargeConsumed, false);
});
