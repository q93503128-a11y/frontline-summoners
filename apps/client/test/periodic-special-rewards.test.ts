import assert from 'node:assert/strict';
import test from 'node:test';
import { PERIODIC_REWARD_RECHARGE_MS, createFullPeriodicRewardChargeMap } from '@frontline/sim/periodic-special';
import { resolveSpecialResourceReward } from '../src/special-rewards.ts';

const NOW = Date.parse('2026-08-30T12:00:00+09:00');

test('periodic first clear uses authored first reward and does not consume collection charge', () => {
  const initial = createFullPeriodicRewardChargeMap();
  const resolved = resolveSpecialResourceReward('special_gold_convoy_01', true, initial, NOW);
  assert.deepEqual(resolved.resourceReward, { gold: 600, sweep_ticket: 1 });
  assert.equal(resolved.periodicChargeMap.special_gold_convoy.charges, 4);
  assert.equal(resolved.chargeConsumed, false);
});

test('periodic repeats consume shared collection charge, remain playable depleted and recover after twelve hours', () => {
  let charges = createFullPeriodicRewardChargeMap();
  for (let index = 0; index < 4; index += 1) {
    const resolved = resolveSpecialResourceReward('special_gold_convoy_01', false, charges, NOW);
    assert.deepEqual(resolved.resourceReward, { gold: 450 });
    assert.equal(resolved.chargeConsumed, true);
    charges = resolved.periodicChargeMap;
  }
  assert.equal(charges.special_gold_convoy.charges, 0);
  const depleted = resolveSpecialResourceReward('special_gold_convoy_02', false, charges, NOW);
  assert.deepEqual(depleted.resourceReward, { gold: 170 }, 'charge is shared by the whole collection and zero charge still gives depleted reward');
  assert.equal(depleted.chargeConsumed, false);
  const recovered = resolveSpecialResourceReward('special_gold_convoy_02', false, depleted.periodicChargeMap, NOW + PERIODIC_REWARD_RECHARGE_MS);
  assert.deepEqual(recovered.resourceReward, { gold: 850 });
  assert.equal(recovered.chargeConsumed, true);
  assert.equal(recovered.periodicChargeMap.special_gold_convoy.charges, 0);
});

test('the four periodic collections keep independent charge pools', () => {
  const initial = createFullPeriodicRewardChargeMap();
  const resolved = resolveSpecialResourceReward('special_soul_forge_01', false, initial, NOW);
  assert.deepEqual(resolved.resourceReward, { soul_essence: 18 });
  assert.equal(resolved.periodicChargeMap.special_soul_forge.charges, 3);
  assert.equal(resolved.periodicChargeMap.special_gold_convoy.charges, 4);
});

test('non-periodic repeat rewards do not mutate periodic charge state', () => {
  const initial = createFullPeriodicRewardChargeMap();
  const resolved = resolveSpecialResourceReward('special_glutton_01', false, initial, NOW);
  assert.deepEqual(resolved.resourceReward, { gold: 250 });
  assert.deepEqual(resolved.periodicChargeMap, initial);
  assert.equal(resolved.periodicCollectionId, undefined);
});
