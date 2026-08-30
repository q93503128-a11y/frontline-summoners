import assert from 'node:assert/strict';
import test from 'node:test';
import { PERIODIC_REWARD_RECHARGE_MS, createFullPeriodicRewardChargeMap } from '@frontline/sim/periodic-special';
import { getGuestPeriodicRewardChargeMap, mergeGuestProgress, normalizeGuestProgress, type GuestProgress } from '../src/save.ts';

const NOW = Date.parse('2026-08-30T12:00:00+09:00');
const baseProgress = (charges = createFullPeriodicRewardChargeMap()): GuestProgress => ({
  clearedStageIds: [], specialClearedStageIds: [], permanentRewardIds: [], periodicRewardChargeByCollection: charges,
});

test('stale save merge cannot resurrect consumed periodic reward charges', () => {
  const full = createFullPeriodicRewardChargeMap();
  const depleted = {
    ...full,
    special_gold_convoy: { charges: 0, nextChargeAtMs: NOW + PERIODIC_REWARD_RECHARGE_MS },
  } as const;
  const merged = normalizeGuestProgress(mergeGuestProgress(baseProgress(full), baseProgress(depleted)));
  const atNow = getGuestPeriodicRewardChargeMap(merged, NOW);
  assert.equal(atNow.special_gold_convoy.charges, 0);
  assert.equal(atNow.special_soul_forge.charges, 4);
});

test('normalized v14 charge state recovers by elapsed twelve-hour intervals', () => {
  const full = createFullPeriodicRewardChargeMap();
  const depleted = {
    ...full,
    special_gold_convoy: { charges: 0, nextChargeAtMs: NOW + PERIODIC_REWARD_RECHARGE_MS },
  } as const;
  const progress = baseProgress(depleted);
  assert.equal(getGuestPeriodicRewardChargeMap(progress, NOW).special_gold_convoy.charges, 0);
  assert.equal(getGuestPeriodicRewardChargeMap(progress, NOW + PERIODIC_REWARD_RECHARGE_MS).special_gold_convoy.charges, 1);
});
