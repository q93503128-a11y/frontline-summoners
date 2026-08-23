import assert from 'node:assert/strict';
import test from 'node:test';
import { UnitState, computeStateHash, createBattle, spawnUnit, stepBattle, type BattleUnitDefinition } from '../src/index.ts';

const fighter = (overrides: Partial<BattleUnitDefinition> = {}): BattleUnitDefinition => ({
  id: 'fighter', maxHp: 100, attackDamage: 100, moveSpeed: 0, standingRange: 100,
  attackMinRange: 0, attackMaxRange: 100, targetMode: 'SINGLE', naturalKnockbackCount: 0,
  naturalKnockbackFrames: 12, naturalKnockbackDistance: 30, deathFrames: 12,
  attackTiming: { cycleFrames: 30, hitFrames: [0], backswingFrames: 6 }, ...overrides,
});

test('same-frame lethal attacks resolve simultaneously', () => {
  const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const left = spawnUnit(state, fighter({ id: 'left' }), 'PLAYER', 500);
  const right = spawnUnit(state, fighter({ id: 'right' }), 'ENEMY', 500);
  stepBattle(state);
  assert.equal(left.hp, 0);
  assert.equal(right.hp, 0);
  assert.equal(left.state, UnitState.Dying);
  assert.equal(right.state, UnitState.Dying);
});

test('one damage batch consumes crossed thresholds but enters knockback once', () => {
  const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  spawnUnit(state, fighter({ id: 'attacker', attackDamage: 80 }), 'PLAYER', 500);
  const defender = spawnUnit(state, fighter({ id: 'defender', naturalKnockbackCount: 3, attackDamage: 0 }), 'ENEMY', 500);
  stepBattle(state);
  assert.equal(defender.hp, 20);
  assert.equal(defender.naturalKnockbacksConsumed, 3);
  assert.equal(defender.state, UnitState.NaturalKnockback);
});

test('identical sequence produces identical final state hash', () => {
  const run = (): string => {
    const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
    spawnUnit(state, fighter({ id: 'p', attackDamage: 20, moveSpeed: 4 }), 'PLAYER', 100);
    spawnUnit(state, fighter({ id: 'e', attackDamage: 20, moveSpeed: 4 }), 'ENEMY', 900);
    for (let index = 0; index < 120; index += 1) stepBattle(state);
    return computeStateHash(state);
  };
  assert.equal(run(), run());
});
