import assert from 'node:assert/strict';
import test from 'node:test';
import { CombatTrait, UnitState, computeStateHash, createBattle, getUnitAttackDamageAgainst, spawnUnit, stepBattle, type BattleUnitDefinition } from '../src/index.ts';

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

test('zero-frame backswing does not add an accidental extra frame', () => {
  const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const attacker = spawnUnit(state, fighter({ id: 'fast', attackDamage: 1, attackTiming: { cycleFrames: 1, hitFrames: [0], backswingFrames: 0 } }), 'PLAYER', 500);
  spawnUnit(state, fighter({ id: 'dummy', attackDamage: 0, maxHp: 1000 }), 'ENEMY', 500);
  stepBattle(state);
  assert.equal(attacker.state, UnitState.AttackWait);
  stepBattle(state);
  assert.notEqual(attacker.state, UnitState.Backswing);
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

test('specialist damage applies only to matching target traits', () => {
  const specialist = fighter({
    id: 'hunter',
    damageBonuses: [{ trait: CombatTrait.Light, multiplierPermille: 1250 }],
  });
  const light = fighter({ id: 'light', maxHp: 500, attackDamage: 0, traits: [CombatTrait.Light] });
  const armored = fighter({ id: 'armored', maxHp: 500, attackDamage: 0, traits: [CombatTrait.Armored] });
  assert.equal(getUnitAttackDamageAgainst(specialist, light), 125);
  assert.equal(getUnitAttackDamageAgainst(specialist, armored), 100);

  const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  spawnUnit(state, specialist, 'PLAYER', 500);
  const target = spawnUnit(state, light, 'ENEMY', 500);
  stepBattle(state);
  assert.equal(target.hp, 375);
});

test('multiple matching target traits use strongest bonus rather than stacking', () => {
  const attacker = fighter({
    id: 'boss-hunter',
    attackDamage: 100,
    damageBonuses: [
      { trait: CombatTrait.Armored, multiplierPermille: 1300 },
      { trait: CombatTrait.Boss, multiplierPermille: 1500 },
    ],
  });
  const target = fighter({ id: 'iron-boss', traits: [CombatTrait.Armored, CombatTrait.Boss] });
  assert.equal(getUnitAttackDamageAgainst(attacker, target), 150);
});

test('specialist bonuses never inflate base damage', () => {
  const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  spawnUnit(state, fighter({
    id: 'boss-hunter',
    damageBonuses: [{ trait: CombatTrait.Boss, multiplierPermille: 3000 }],
  }), 'PLAYER', 950);
  stepBattle(state);
  assert.equal(state.bases.ENEMY.hp, 900);
});
