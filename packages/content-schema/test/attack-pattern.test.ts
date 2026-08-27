import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEnemies } from '../src/index.ts';

const BASE_ENEMY = {
  id: 'pattern_enemy',
  displayName: '패턴 적',
  maxHp: 1000,
  attackDamage: 100,
  moveSpeed: 2,
  standingRange: 120,
  attackMinRange: 0,
  attackMaxRange: 120,
  cycleFrames: 60,
  hitFrames: [20],
  backswingFrames: 10,
  naturalKnockbackCount: 1,
  targetMode: 'AREA',
  attributes: ['MACHINE'],
  combatTags: ['BOSS'],
  damageBonuses: [],
  rewardSupply: 250,
} as const;

test('parseEnemies preserves deterministic attackPattern steps', () => {
  const attackPattern = [
    { attackDamage: 100, attackMinRange: 0, attackMaxRange: 120, cycleFrames: 60, hitFrames: [20] },
    { attackDamage: 100, attackMinRange: 0, attackMaxRange: 120, cycleFrames: 60, hitFrames: [20] },
    { attackDamage: 240, attackMinRange: 40, attackMaxRange: 180, cycleFrames: 90, hitFrames: [30, 45] },
  ];

  const [enemy] = parseEnemies([{ ...BASE_ENEMY, attackPattern }]);
  assert.deepEqual(enemy?.attackPattern, attackPattern);
});

test('parseEnemies rejects empty or malformed attackPattern data', () => {
  assert.throws(
    () => parseEnemies([{ ...BASE_ENEMY, attackPattern: [] }]),
    /attackPattern must be a non-empty array/,
  );
  assert.throws(
    () => parseEnemies([{
      ...BASE_ENEMY,
      attackPattern: [
        { attackDamage: 100, attackMinRange: 0, attackMaxRange: 120, cycleFrames: 30, hitFrames: [30] },
      ],
    }]),
    /hitFrames\[0\] must be inside cycleFrames/,
  );
});
