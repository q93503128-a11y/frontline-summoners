import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAreaDamageToTeam,
  createBattle,
  spawnUnit,
  stepBattle,
  type BattleUnitDefinition,
} from '../src/index.ts';

function unit(
  id: string,
  overrides: Partial<BattleUnitDefinition> = {},
): BattleUnitDefinition {
  return {
    id,
    maxHp: 1000,
    attackDamage: 100,
    moveSpeed: 0,
    standingRange: 100,
    attackMinRange: 0,
    attackMaxRange: 120,
    targetMode: 'SINGLE',
    naturalKnockbackCount: 0,
    naturalKnockbackFrames: 12,
    naturalKnockbackDistance: 34,
    deathFrames: 12,
    attackTiming: { cycleFrames: 100, hitFrames: [1], backswingFrames: 0 },
    attributes: ['NEUTRAL'],
    combatTags: [],
    damageBonuses: [],
    ...overrides,
  };
}

test('guaranteed Weaken reduces outgoing damage for its duration and then expires deterministically', () => {
  const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const weakener = spawnUnit(state, unit('weakener', {
    attackDamage: 1,
    attackTiming: { cycleFrames: 200, hitFrames: [0], backswingFrames: 0 },
    onHitWeaken: { chancePermille: 1000, durationFrames: 90, attackPermille: 750 },
  }), 'PLAYER', 100);
  const attacker = spawnUnit(state, unit('attacker'), 'ENEMY', 150);

  stepBattle(state);
  assert.equal(attacker.weakenAttackPermille, 750);
  assert.equal(attacker.weakenUntilTick, 90);

  stepBattle(state);
  assert.equal(weakener.hp, 925, '100 damage must be reduced to 75 while Weaken is active');

  while (state.tick < 102) stepBattle(state);
  assert.equal(weakener.hp, 825, 'the next attack after Weaken expires must deal the full 100 damage');
  assert.equal(attacker.weakenAttackPermille, 1000);
});

test('HP threshold advance triggers once per authored threshold and accelerates only the next attack startup', () => {
  const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const dummy = spawnUnit(state, unit('dummy', {
    attackDamage: 0,
    attackTiming: { cycleFrames: 999, hitFrames: [998], backswingFrames: 0 },
  }), 'PLAYER', 430);
  const boss = spawnUnit(state, unit('threshold-boss', {
    standingRange: 170,
    attackDamage: 100,
    attackTiming: { cycleFrames: 102, hitFrames: [35], backswingFrames: 0 },
    hpThresholdAdvance: {
      thresholdsPermille: [600, 300],
      distance: 210,
      nextAttackStartupReductionFrames: 18,
    },
  }), 'ENEMY', 700);

  assert.equal(applyAreaDamageToTeam(state, 'ENEMY', 450), 1);
  assert.equal(boss.hp, 550);
  assert.equal(boss.anchorX, 490);
  assert.equal(boss.hpThresholdAdvancesConsumed, 1);
  assert.equal(boss.nextAttackStartupReductionFrames, 18);

  stepBattle(state);
  assert.equal(boss.activeAttackStartupReductionFrames, 18);
  assert.equal(boss.nextAttackStartupReductionFrames, 0);
  for (let i = 0; i < 16; i += 1) stepBattle(state);
  assert.equal(dummy.hp, 1000, '35F startup reduced by 18F must not hit before frame 17');
  stepBattle(state);
  assert.equal(dummy.hp, 900, 'the accelerated next attack must hit at frame 17');

  assert.equal(applyAreaDamageToTeam(state, 'ENEMY', 300), 1);
  assert.equal(boss.hp, 250);
  assert.equal(boss.anchorX, 280);
  assert.equal(boss.hpThresholdAdvancesConsumed, 2);

  assert.equal(applyAreaDamageToTeam(state, 'ENEMY', 50), 1);
  assert.equal(boss.anchorX, 280, 'already consumed thresholds must never retrigger');
  assert.equal(boss.hpThresholdAdvancesConsumed, 2);
});
