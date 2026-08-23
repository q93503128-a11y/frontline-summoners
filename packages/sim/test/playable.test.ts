import assert from 'node:assert/strict';
import test from 'node:test';
import type { BattleUnitDefinition } from '../src/index.ts';
import { createPlayableBattle, getCooldownRemaining, stepPlayableBattle, trySpawnPlayerUnit, tryUpgradeSupply, type PlayableBattleConfig } from '../src/playable.ts';

const unit = (id: string, overrides: Partial<BattleUnitDefinition> = {}): BattleUnitDefinition => ({
  id,
  maxHp: 100,
  attackDamage: 10,
  moveSpeed: 1,
  standingRange: 40,
  attackMinRange: 0,
  attackMaxRange: 50,
  targetMode: 'SINGLE',
  naturalKnockbackCount: 1,
  naturalKnockbackFrames: 12,
  naturalKnockbackDistance: 20,
  deathFrames: 12,
  attackTiming: { cycleFrames: 30, hitFrames: [5], backswingFrames: 6 },
  ...overrides,
});

const config = (): PlayableBattleConfig => ({
  mapLength: 1000,
  playerBaseHp: 1000,
  enemyBaseHp: 1000,
  startingSupply: 300,
  playerSlots: [
    { slotId: 'cheap', displayName: 'cheap', definition: unit('cheap'), cost: 50, rechargeFrames: 45 },
  ],
  enemies: [
    { enemyId: 'grunt', displayName: 'grunt', definition: unit('grunt'), rewardSupply: 25 },
  ],
  enemyWaves: [
    { enemyId: 'grunt', atTick: 10, count: 2, intervalTicks: 20 },
  ],
});

test('level 1 economy produces exactly 65 supply over 30 ticks', () => {
  const state = createPlayableBattle(config());
  for (let i = 0; i < 30; i += 1) stepPlayableBattle(state);
  assert.equal(state.supply, 365);
  assert.equal(state.incomeRemainder, 0);
});

test('spawning consumes supply and starts deterministic cooldown', () => {
  const state = createPlayableBattle(config());
  const result = trySpawnPlayerUnit(state, 'cheap');
  assert.equal(result.ok, true);
  assert.equal(state.supply, 250);
  assert.equal(getCooldownRemaining(state, 'cheap'), 45);
  const blocked = trySpawnPlayerUnit(state, 'cheap');
  assert.deepEqual(blocked, { ok: false, reason: 'cooldown' });
  for (let i = 0; i < 45; i += 1) stepPlayableBattle(state);
  assert.equal(getCooldownRemaining(state, 'cheap'), 0);
});

test('supply upgrades spend supply and switch income/max tier', () => {
  const state = createPlayableBattle({ ...config(), startingSupply: 1000 });
  const result = tryUpgradeSupply(state);
  assert.deepEqual(result, { ok: true, level: 2 });
  assert.equal(state.supply, 650);
  for (let i = 0; i < 30; i += 1) stepPlayableBattle(state);
  assert.equal(state.supply, 728);
});

test('scheduled enemy waves spawn at deterministic ticks', () => {
  const state = createPlayableBattle(config());
  for (let i = 0; i < 10; i += 1) stepPlayableBattle(state);
  assert.equal(state.battle.units.filter((candidate) => candidate.team === 'ENEMY').length, 0);
  stepPlayableBattle(state);
  assert.equal(state.battle.units.filter((candidate) => candidate.team === 'ENEMY').length, 1);
  for (let i = 0; i < 19; i += 1) stepPlayableBattle(state);
  assert.equal(state.battle.units.filter((candidate) => candidate.team === 'ENEMY').length, 1);
  stepPlayableBattle(state);
  assert.equal(state.battle.units.filter((candidate) => candidate.team === 'ENEMY').length, 2);
});

test('identical playable command sequence yields identical hash', () => {
  const run = (): string => {
    const state = createPlayableBattle(config());
    trySpawnPlayerUnit(state, 'cheap');
    for (let i = 0; i < 180; i += 1) {
      if (i === 60) trySpawnPlayerUnit(state, 'cheap');
      stepPlayableBattle(state);
    }
    return state.stateHash;
  };
  assert.equal(run(), run());
});
