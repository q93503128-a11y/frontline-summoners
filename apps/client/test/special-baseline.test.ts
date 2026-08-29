import assert from 'node:assert/strict';
import test from 'node:test';
import { SPECIAL_STAGES } from '../src/prototype.ts';
import { autoPlaySpecialStage } from './special-baseline.ts';

test('first five challenge SPECIAL stages remain deterministically clearable by a completed chapter-one account', () => {
  const results = SPECIAL_STAGES.slice(0, 5).map((_, index) => autoPlaySpecialStage(index, 720));
  assert.equal(results.length, 5);
  for (const [index, result] of results.entries()) {
    const stage = SPECIAL_STAGES[index]!;
    assert.equal(result.state.battle.winner, 'PLAYER', `${stage.id} ${stage.name} must be clearable by the deterministic completed-account baseline`);
    assert.ok(result.spawnCount > 0, `${stage.id} must require actual deployment`);
    assert.ok(result.maxAlivePlayerUnits <= result.state.playerUnitCap, `${stage.id} baseline exceeded the live player cap`);
    assert.ok(result.state.battle.bases.ENEMY.hp <= 0, `${stage.id} victory must come from destroying the enemy base`);
  }
});

test('double-boss challenge locks both advertised boss phases against an early base rush', () => {
  const stage = SPECIAL_STAGES[4]!;
  assert.equal(stage.id, 'special-05');
  const waves = new Map(stage.waves.map((wave) => [wave.id, wave] as const));
  assert.deepEqual(waves.get('W3')?.trigger, { type: 'ANY_OF', conditions: [{ type: 'TIME', frame: 1050 }, { type: 'ENEMY_BASE_HP_BELOW', percent: 80 }] });
  assert.equal(waves.get('W3')?.spawn.enemyId, 'enemy-boss');
  assert.deepEqual(waves.get('W5')?.trigger, { type: 'ANY_OF', conditions: [{ type: 'AFTER_WAVE_CLEARED', waveId: 'W3', delayFrames: 180 }, { type: 'ENEMY_BASE_HP_BELOW', percent: 45 }] });
  assert.deepEqual(waves.get('W6')?.trigger, { type: 'AFTER_WAVE_TRIGGERED', waveId: 'W5', delayFrames: 100 });
});

test('challenge boss stages cannot finish before their advertised bosses actually appear', () => {
  const threeVow = autoPlaySpecialStage(3, 720);
  const doubleBoss = autoPlaySpecialStage(4, 720);
  assert.equal(threeVow.state.battle.winner, 'PLAYER');
  assert.ok(threeVow.seenEnemyIds.has('enemy-boss-iron'));
  assert.equal(doubleBoss.state.battle.winner, 'PLAYER');
  assert.ok(doubleBoss.seenEnemyIds.has('enemy-boss'));
  assert.ok(doubleBoss.seenEnemyIds.has('enemy-boss-iron'));
});

test('the two three-unit challenges keep their authored fixed deployment cap of three', () => {
  const threeSlot = autoPlaySpecialStage(0, 720);
  const threeVow = autoPlaySpecialStage(3, 720);
  assert.equal(threeSlot.state.playerUnitCap, 3);
  assert.equal(threeVow.state.playerUnitCap, 3);
  assert.ok(threeSlot.maxAlivePlayerUnits <= 3);
  assert.ok(threeVow.maxAlivePlayerUnits <= 3);
});
