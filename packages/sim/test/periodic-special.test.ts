import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PERIODIC_REWARD_CHARGE_MAX,
  PERIODIC_REWARD_RECHARGE_MS,
  consumePeriodicRewardCharge,
  createFullPeriodicRewardChargeState,
  getPeriodicCollectionWindowState,
  refreshPeriodicRewardChargeState,
} from '../src/periodic-special.ts';

const HOUR = 60 * 60 * 1000;

test('periodic reward charge consumes four charged runs then remains playable depleted', () => {
  const now = Date.parse('2026-08-30T00:00:00Z');
  let state = createFullPeriodicRewardChargeState();
  for (let index = 0; index < PERIODIC_REWARD_CHARGE_MAX; index += 1) {
    const result = consumePeriodicRewardCharge(state, now);
    assert.equal(result.consumed, true);
    state = result.state;
  }
  assert.equal(state.charges, 0);
  assert.equal(state.nextChargeAtMs, now + PERIODIC_REWARD_RECHARGE_MS);
  const depleted = consumePeriodicRewardCharge(state, now);
  assert.equal(depleted.consumed, false);
  assert.equal(depleted.state.charges, 0);
});

test('periodic reward charge recovers every twelve hours even while no stage window is open', () => {
  const now = Date.parse('2026-08-30T00:00:00Z');
  const empty = { charges: 0, nextChargeAtMs: now + PERIODIC_REWARD_RECHARGE_MS } as const;
  assert.equal(refreshPeriodicRewardChargeState(empty, now + PERIODIC_REWARD_RECHARGE_MS).charges, 1);
  assert.equal(refreshPeriodicRewardChargeState(empty, now + PERIODIC_REWARD_RECHARGE_MS * 4).charges, 4);
  assert.equal(refreshPeriodicRewardChargeState(empty, now + PERIODIC_REWARD_RECHARGE_MS * 100).charges, 4);
});

test('periodic collection window repeats deterministic 72h open inside the canonical 168h cycle', () => {
  const epochMs = Date.parse('2026-08-30T00:00:00+09:00');
  const schedule = {
    collectionId: 'special_gold_convoy' as const,
    epochMs,
    cycleMs: 168 * HOUR,
    openMs: 72 * HOUR,
    offsetMs: 0,
  };
  assert.equal(getPeriodicCollectionWindowState(schedule, epochMs).available, true);
  assert.equal(getPeriodicCollectionWindowState(schedule, epochMs + 71 * HOUR).available, true);
  const closed = getPeriodicCollectionWindowState(schedule, epochMs + 73 * HOUR);
  assert.equal(closed.available, false);
  assert.equal(closed.opensAtMs, epochMs + 168 * HOUR);
  assert.equal(getPeriodicCollectionWindowState(schedule, epochMs + 169 * HOUR).available, true);
});
