import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEMIES, getStage } from '../src/prototype.ts';
import {
  createDefaultPeriodicSpecialChargeMap,
  resolveSpecialResourceReward,
} from '../src/special-rewards.ts';

function enemy(id: string) {
  const found = ENEMIES.find((candidate) => candidate.enemyId === id);
  assert.ok(found, `missing runtime enemy ${id}`);
  return found;
}

function specialReward(stageId: string, firstClear: boolean) {
  return resolveSpecialResourceReward(
    stageId,
    firstClear,
    createDefaultPeriodicSpecialChargeMap(),
    0,
  ).resourceReward;
}

test('permanent SPECIAL boss mechanics survive content-to-simulation runtime wiring', () => {
  assert.deepEqual(enemy('boss_sp_glutton_drake').definition.hpThresholdAdvance, {
    thresholdsPermille: [600, 300],
    distance: 210,
    nextAttackStartupReductionFrames: 18,
  });
  assert.deepEqual(enemy('boss_sp_undying_night').definition.reviveOnce, {
    delayFrames: 150,
    hpPermille: 350,
  });
  assert.deepEqual(enemy('boss_sp_unobservable').definition.attackPattern?.[2]?.onHitWeaken, {
    chancePermille: 1000,
    durationFrames: 90,
    attackPermille: 750,
  });
});

test('young glutton is an explicit non-boss execution enemy rather than a scaled final boss', () => {
  const juvenile = enemy('enemy_sp_glutton_juvenile');
  assert.equal(juvenile.definition.combatTags?.includes('BOSS'), false);
  const firstStage = getStage('special_glutton_01');
  assert.equal(firstStage.waves[1]?.spawn.enemyId, 'enemy_sp_glutton_juvenile');
  assert.equal(firstStage.waves[3]?.spawn.enemyId, 'enemy_sp_glutton_juvenile');
});

test('permanent challenge repeat rewards stay low while first clears carry evolution and summon value', () => {
  assert.deepEqual(specialReward('special_glutton_04', false), { gold: 900 });
  const first = specialReward('special_glutton_04', true);
  assert.equal(first.gold, 5400);
  assert.equal(first.evo_core, 3);
  assert.equal(first.evo_crown, 1);
  assert.equal(first.summon_crystal, 80);

  assert.deepEqual(specialReward('special_anomaly_04', false), { gold: 1050 });
  assert.equal(specialReward('special_anomaly_04', true).summon_crystal, 120);
});
