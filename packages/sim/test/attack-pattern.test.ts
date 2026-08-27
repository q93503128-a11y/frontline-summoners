import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBattle,
  spawnUnit,
  stepBattle,
  type BattleUnitDefinition,
} from '../src/index.ts';

const BASE_ATTACKER: BattleUnitDefinition = {
  id: 'pattern-attacker',
  maxHp: 100,
  attackDamage: 10,
  moveSpeed: 0,
  standingRange: 60,
  attackMinRange: 0,
  attackMaxRange: 60,
  targetMode: 'SINGLE',
  naturalKnockbackCount: 0,
  naturalKnockbackFrames: 1,
  naturalKnockbackDistance: 0,
  deathFrames: 1,
  attackTiming: {
    cycleFrames: 1,
    hitFrames: [0],
    backswingFrames: 0,
  },
  attributes: ['NEUTRAL'],
};

test('attackPattern cycles deterministically through A-A-B and repeats', () => {
  const definition: BattleUnitDefinition = {
    ...BASE_ATTACKER,
    attackPattern: [
      { attackDamage: 10, attackMinRange: 0, attackMaxRange: 60, cycleFrames: 1, hitFrames: [0] },
      { attackDamage: 10, attackMinRange: 0, attackMaxRange: 60, cycleFrames: 1, hitFrames: [0] },
      { attackDamage: 25, attackMinRange: 0, attackMaxRange: 60, cycleFrames: 1, hitFrames: [0] },
    ],
  };
  const battle = createBattle({ mapLength: 50, playerBaseHp: 100, enemyBaseHp: 1000 });
  const attacker = spawnUnit(battle, definition, 'PLAYER');

  const enemyBaseHp: number[] = [];
  const patternIndices: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    stepBattle(battle);
    enemyBaseHp.push(battle.bases.ENEMY.hp);
    patternIndices.push(attacker.attackPatternIndex);
  }

  assert.deepEqual(enemyBaseHp, [990, 980, 955, 945]);
  assert.deepEqual(patternIndices, [1, 2, 0, 1]);
});

test('attackPattern step range is used for the active attack', () => {
  const definition: BattleUnitDefinition = {
    ...BASE_ATTACKER,
    attackPattern: [
      { attackDamage: 10, attackMinRange: 0, attackMaxRange: 30, cycleFrames: 1, hitFrames: [0] },
      { attackDamage: 20, attackMinRange: 0, attackMaxRange: 60, cycleFrames: 1, hitFrames: [0] },
    ],
  };
  const battle = createBattle({ mapLength: 50, playerBaseHp: 100, enemyBaseHp: 1000 });
  spawnUnit(battle, definition, 'PLAYER');

  stepBattle(battle);
  assert.equal(battle.bases.ENEMY.hp, 1000, 'the short-range step must miss the distant base');
  stepBattle(battle);
  assert.equal(battle.bases.ENEMY.hp, 980, 'the next pattern step must use its own longer range and damage');
});

test('invalid empty attackPattern is rejected at spawn time', () => {
  const battle = createBattle({ mapLength: 50, playerBaseHp: 100, enemyBaseHp: 100 });
  assert.throws(
    () => spawnUnit(battle, { ...BASE_ATTACKER, attackPattern: [] }, 'PLAYER'),
    /attackPattern must contain at least one step/,
  );
});
