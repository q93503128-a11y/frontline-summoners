import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEnemies } from '../src/index.ts';

const enemy = {
  id: 'boss_schema_test',
  displayName: 'Schema Test',
  maxHp: 1000,
  attackDamage: 120,
  moveSpeed: 1,
  standingRange: 150,
  attackMinRange: 0,
  attackMaxRange: 180,
  cycleFrames: 90,
  hitFrames: [30],
  backswingFrames: 10,
  naturalKnockbackCount: 2,
  targetMode: 'AREA',
  attributes: ['ANOMALY'],
  combatTags: ['BOSS'],
  damageBonuses: [],
  rewardSupply: 100,
  attackPattern: [
    {
      attackDamage: 80,
      attackMinRange: 60,
      attackMaxRange: 260,
      cycleFrames: 120,
      hitFrames: [44],
      onHitWeaken: { chancePermille: 1000, durationFrames: 90, attackPermille: 750 },
    },
  ],
  hpThresholdAdvance: {
    thresholdsPermille: [600, 300],
    distance: 210,
    nextAttackStartupReductionFrames: 18,
  },
} as const;

test('content schema preserves Weaken and HP-threshold advance combat metadata', () => {
  const [parsed] = parseEnemies([enemy]);
  assert.deepEqual(parsed?.attackPattern?.[0]?.onHitWeaken, {
    chancePermille: 1000,
    durationFrames: 90,
    attackPermille: 750,
  });
  assert.deepEqual(parsed?.hpThresholdAdvance, {
    thresholdsPermille: [600, 300],
    distance: 210,
    nextAttackStartupReductionFrames: 18,
  });
});

test('content schema rejects non-weakening attack multipliers and unordered HP thresholds', () => {
  assert.throws(() => parseEnemies([{
    ...enemy,
    attackPattern: [{
      ...enemy.attackPattern[0],
      onHitWeaken: { chancePermille: 1000, durationFrames: 90, attackPermille: 1000 },
    }],
  }]), /attackPermille/);

  assert.throws(() => parseEnemies([{
    ...enemy,
    hpThresholdAdvance: {
      ...enemy.hpThresholdAdvance,
      thresholdsPermille: [300, 600],
    },
  }]), /strictly descending/);
});
