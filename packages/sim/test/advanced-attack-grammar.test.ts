import assert from 'node:assert/strict';
import test from 'node:test';
import { createBattle, spawnUnit, stepBattle, type BattleUnitDefinition } from '../src/index.ts';

const base = (overrides: Partial<BattleUnitDefinition> = {}): BattleUnitDefinition => ({
  id: 'attacker', maxHp: 1000, attackDamage: 10, moveSpeed: 0, standingRange: 100,
  attackMinRange: 0, attackMaxRange: 100, targetMode: 'SINGLE', naturalKnockbackCount: 0,
  naturalKnockbackFrames: 1, naturalKnockbackDistance: 0, deathFrames: 1,
  attackTiming: { cycleFrames: 1, hitFrames: [0], backswingFrames: 0 },
  attributes: ['NEUTRAL'], combatTags: [], damageBonuses: [], ...overrides,
});

test('HP attack phases switch deterministic loop without random branching', () => {
  const attackerDef = base({
    attackPattern: [
      { attackDamage: 10, attackMinRange: 0, attackMaxRange: 100, cycleFrames: 1, hitFrames: [0] },
      { attackDamage: 20, attackMinRange: 0, attackMaxRange: 100, cycleFrames: 1, hitFrames: [0] },
      { attackDamage: 30, attackMinRange: 0, attackMaxRange: 100, cycleFrames: 1, hitFrames: [0] },
    ],
    attackPhases: [
      { maxHpPermille: 1000, patternIndices: [0, 0, 1] },
      { maxHpPermille: 500, patternIndices: [2, 0] },
    ],
  });
  const battle = createBattle({ mapLength: 50, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const attacker = spawnUnit(battle, attackerDef, 'PLAYER');
  for (let i = 0; i < 3; i += 1) stepBattle(battle);
  assert.equal(battle.bases.ENEMY.hp, 960, 'phase one uses A-A-B');
  attacker.hp = 500;
  stepBattle(battle);
  stepBattle(battle);
  assert.equal(battle.bases.ENEMY.hp, 920, 'phase two resets to C-A');
  assert.equal(attacker.attackPhaseIndex, 1);
});

test('per-hit damage split applies exact authored amounts', () => {
  const battle = createBattle({ mapLength: 50, playerBaseHp: 1000, enemyBaseHp: 1000 });
  spawnUnit(battle, base({
    attackDamage: 0,
    attackTiming: { cycleFrames: 10, hitFrames: [0, 1, 2], backswingFrames: 0 },
    hitDamages: [25, 25, 50],
  }), 'PLAYER');
  stepBattle(battle);
  assert.equal(battle.bases.ENEMY.hp, 975);
  stepBattle(battle);
  assert.equal(battle.bases.ENEMY.hp, 950);
  stepBattle(battle);
  assert.equal(battle.bases.ENEMY.hp, 900);
});

test('per-hit push occurs only on the authored final hit', () => {
  const battle = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const attacker = spawnUnit(battle, base({
    standingRange: 150, attackMinRange: 0, attackMaxRange: 150,
    attackDamage: 0,
    attackTiming: { cycleFrames: 10, hitFrames: [0, 1, 2], backswingFrames: 0 },
    hitDamages: [25, 25, 50],
    hitEffects: [{}, {}, { onHitPush: { chancePermille: 1000, distance: 45, frames: 3 } }],
  }), 'PLAYER', 500);
  const target = spawnUnit(battle, base({ id: 'target', maxHp: 1000, attackDamage: 0 }), 'ENEMY', 550);
  stepBattle(battle);
  assert.equal(target.hp, 975);
  assert.notEqual(target.state, 'FORCED_DISPLACEMENT');
  stepBattle(battle);
  assert.equal(target.hp, 950);
  assert.notEqual(target.state, 'FORCED_DISPLACEMENT');
  stepBattle(battle);
  assert.equal(target.hp, 900);
  assert.equal(target.state, 'FORCED_DISPLACEMENT');
  assert.equal(attacker.attackPhaseIndex, 0);
});

test('snapshot damage reduction protects only listed current units and expires deterministically', async () => {
  const { applyDamageTakenModifierToUnitIds } = await import('../src/index.ts');
  const battle = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const protectedUnit = spawnUnit(battle, base({ id: 'protected', attackDamage: 0 }), 'PLAYER', 500);
  const laterUnit = spawnUnit(battle, base({ id: 'later', attackDamage: 0 }), 'PLAYER', 510);
  const enemy = spawnUnit(battle, base({ id: 'enemy', attackDamage: 100, targetMode: 'AREA' }), 'ENEMY', 500);
  applyDamageTakenModifierToUnitIds(battle, 'PLAYER', [protectedUnit.simulationId], 2, 750);
  stepBattle(battle);
  assert.equal(protectedUnit.hp, 925);
  assert.equal(laterUnit.hp, 900);
  enemy.nextAttackTick = battle.tick;
  stepBattle(battle);
  enemy.nextAttackTick = battle.tick;
  stepBattle(battle);
  assert.ok(protectedUnit.damageTakenPermille === 1000);
});
