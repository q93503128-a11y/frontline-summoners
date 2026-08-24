import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnUnit, type BattleUnitDefinition } from '../src/index.ts';
import {
  DEFAULT_SUPPLY_LEVELS,
  createPlayableBattle,
  getBaseWeaponCooldownRemaining,
  getCooldownRemaining,
  stepPlayableBattle,
  tryFireBaseWeapon,
  trySpawnPlayerUnit,
  tryUpgradeSupply,
  type PlayableBattleConfig,
} from '../src/playable.ts';

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

test('default economy starts with a deliberately small wallet and slow income', () => {
  assert.deepEqual(DEFAULT_SUPPLY_LEVELS[0], { incomePerSecond: 12, maxSupply: 1000, upgradeCost: 0 });
  assert.deepEqual(DEFAULT_SUPPLY_LEVELS[1], { incomePerSecond: 16, maxSupply: 1400, upgradeCost: 160 });
  assert.equal(DEFAULT_SUPPLY_LEVELS.length, 8);
});

test('level 1 economy produces exactly 12 supply over 30 ticks', () => {
  const state = createPlayableBattle(config());
  for (let i = 0; i < 30; i += 1) stepPlayableBattle(state);
  assert.equal(state.supply, 312);
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
  assert.equal(state.supply, 840);
  for (let i = 0; i < 30; i += 1) stepPlayableBattle(state);
  assert.equal(state.supply, 856);
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

test('base weapon is initially ready and natural KB takes priority over cannon push', () => {
  const state = createPlayableBattle({
    ...config(),
    baseWeapon: { damage: 60, cooldownFrames: 90, pushDistance: 60, pushFrames: 10 },
    enemyWaves: [{ enemyId: 'grunt', atTick: 0, count: 1, intervalTicks: 999 }],
  });
  assert.equal(getBaseWeaponCooldownRemaining(state), 0);
  assert.deepEqual(tryFireBaseWeapon(state), { ok: true, readyTick: 90 });
  assert.deepEqual(tryFireBaseWeapon(state), { ok: false, reason: 'already_pending' });
  stepPlayableBattle(state);
  const enemy = state.battle.units.find((candidate) => candidate.team === 'ENEMY');
  assert.ok(enemy);
  assert.equal(enemy.hp, 40);
  assert.equal(enemy.state, 'NATURAL_KNOCKBACK');
  assert.equal(enemy.forcedDisplacementFrames, 0);
  assert.equal(getBaseWeaponCooldownRemaining(state), 89);
});

test('base weapon pushes surviving enemies through the forced-displacement state', () => {
  const state = createPlayableBattle({
    ...config(),
    baseWeapon: { damage: 20, cooldownFrames: 90, pushDistance: 60, pushFrames: 3 },
    enemyWaves: [],
  });
  const enemy = spawnUnit(state.battle, unit('tank', { maxHp: 1000, attackDamage: 0, moveSpeed: 0, naturalKnockbackCount: 0 }), 'ENEMY', 600);
  tryFireBaseWeapon(state);

  stepPlayableBattle(state);
  assert.equal(enemy.hp, 980);
  assert.equal(enemy.state, 'FORCED_DISPLACEMENT');
  assert.equal(enemy.anchorX, 620);
  stepPlayableBattle(state);
  assert.equal(enemy.anchorX, 640);
  stepPlayableBattle(state);
  assert.equal(enemy.anchorX, 660);
  assert.equal(enemy.state, 'MOVING');
});

test('base weapon kills grant the same enemy reward and remain deterministic', () => {
  const run = (): { supply: number; hash: string } => {
    const state = createPlayableBattle({
      ...config(),
      baseWeapon: { damage: 120, cooldownFrames: 120, pushDistance: 60, pushFrames: 10 },
      enemyWaves: [{ enemyId: 'grunt', atTick: 0, count: 1, intervalTicks: 999 }],
    });
    tryFireBaseWeapon(state);
    stepPlayableBattle(state);
    assert.equal(state.battle.units[0]?.state, 'DYING');
    return { supply: state.supply, hash: state.stateHash };
  };
  const a = run();
  const b = run();
  assert.equal(a.supply, 325);
  assert.equal(a.hash, b.hash);
});

test('identical playable command sequence yields identical hash', () => {
  const run = (): string => {
    const state = createPlayableBattle(config());
    trySpawnPlayerUnit(state, 'cheap');
    for (let i = 0; i < 180; i += 1) {
      if (i === 30) tryFireBaseWeapon(state);
      if (i === 60) trySpawnPlayerUnit(state, 'cheap');
      stepPlayableBattle(state);
    }
    return state.stateHash;
  };
  assert.equal(run(), run());
});

test('playable hash includes future economy, slot, enemy, wave and cap configuration', () => {
  const baseline = createPlayableBattle(config());
  const richerIncome = createPlayableBattle({
    ...config(),
    supplyLevels: [{ incomePerSecond: 13, maxSupply: 1000, upgradeCost: 0 }],
  });
  const pricierSlot = createPlayableBattle({
    ...config(),
    playerSlots: [{ slotId: 'cheap', displayName: 'cheap', definition: unit('cheap'), cost: 51, rechargeFrames: 45 }],
  });
  const richerEnemy = createPlayableBattle({
    ...config(),
    enemies: [{ enemyId: 'grunt', displayName: 'grunt', definition: unit('grunt'), rewardSupply: 26 }],
  });
  const widerWave = createPlayableBattle({
    ...config(),
    enemyWaves: [{ enemyId: 'grunt', atTick: 10, count: 3, intervalTicks: 20 }],
  });
  const smallerCap = createPlayableBattle({ ...config(), playerUnitCap: 49 });

  assert.notEqual(baseline.stateHash, richerIncome.stateHash);
  assert.notEqual(baseline.stateHash, pricierSlot.stateHash);
  assert.notEqual(baseline.stateHash, richerEnemy.stateHash);
  assert.notEqual(baseline.stateHash, widerWave.stateHash);
  assert.notEqual(baseline.stateHash, smallerCap.stateHash);
});