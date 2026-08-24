import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CombatTrait,
  UnitState,
  applyForcedDisplacementToTeam,
  computeStateHash,
  createBattle,
  getUnitAttackDamageAgainst,
  spawnUnit,
  stepBattle,
  type BattleUnitDefinition,
} from '../src/index.ts';

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

test('battle hash includes map geometry and immutable base definitions', () => {
  const base = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const longer = createBattle({ mapLength: 1200, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const tougherPlayerBase = createBattle({ mapLength: 1000, playerBaseHp: 1200, enemyBaseHp: 1000 });
  assert.notEqual(base.stateHash, longer.stateHash, 'different map lengths change future movement/base contact and must change hash');
  assert.notEqual(base.stateHash, tougherPlayerBase.stateHash, 'different max base HP definitions must not share a hash');
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

test('forced displacement moves units backward over exact frames and cancels their current action', () => {
  const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const enemy = spawnUnit(state, fighter({ id: 'pushed', attackDamage: 0 }), 'ENEMY', 600);
  enemy.state = UnitState.Foreswing;
  enemy.stateFrame = 3;
  enemy.nextAttackTick = 30;

  assert.equal(applyForcedDisplacementToTeam(state, 'ENEMY', 90, 3), 1);
  assert.equal(enemy.state, UnitState.ForcedDisplacement);
  assert.equal(enemy.anchorX, 600);
  assert.equal(enemy.knockbackTargetX, 690);

  stepBattle(state);
  assert.equal(enemy.anchorX, 630);
  assert.equal(enemy.state, UnitState.ForcedDisplacement);
  stepBattle(state);
  assert.equal(enemy.anchorX, 660);
  stepBattle(state);
  assert.equal(enemy.anchorX, 690);
  assert.equal(enemy.state, UnitState.Moving);
});

test('forced displacement keeps hurtbox active but natural knockback takes priority after threshold damage', () => {
  const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const attacker = spawnUnit(state, fighter({ id: 'attacker', attackDamage: 60, attackTiming: { cycleFrames: 30, hitFrames: [1], backswingFrames: 6 } }), 'PLAYER', 500);
  const enemy = spawnUnit(state, fighter({ id: 'target', maxHp: 100, attackDamage: 0, naturalKnockbackCount: 1 }), 'ENEMY', 550);
  applyForcedDisplacementToTeam(state, 'ENEMY', 60, 6);
  assert.equal(enemy.state, UnitState.ForcedDisplacement);

  attacker.state = UnitState.Foreswing;
  attacker.stateFrame = 0;
  stepBattle(state);
  assert.equal(enemy.hp, 40);
  assert.equal(enemy.state, UnitState.NaturalKnockback);
  assert.equal(enemy.forcedDisplacementFrames, 0);
});

test('state hash includes future-relevant displacement runtime state', () => {
  const a = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const b = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const ua = spawnUnit(a, fighter({ id: 'same' }), 'ENEMY', 500);
  const ub = spawnUnit(b, fighter({ id: 'same' }), 'ENEMY', 500);
  applyForcedDisplacementToTeam(a, 'ENEMY', 30, 5);
  applyForcedDisplacementToTeam(b, 'ENEMY', 60, 5);
  // Same current anchor/state/frame but different future target must not hash equal.
  assert.equal(ua.anchorX, ub.anchorX);
  assert.equal(ua.state, ub.state);
  assert.notEqual(a.stateHash, b.stateHash);
});
