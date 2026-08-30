import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEMIES, SPECIAL_STAGES, getStage } from '../src/prototype.ts';

const PERIODIC_STAGE_PREFIXES = ['special_gold_convoy_', 'special_soul_forge_', 'special_evolution_gate_', 'special_starlight_rift_'] as const;
const PERIODIC_ENEMY_PREFIXES = ['enemy_sp_gold_', 'boss_sp_gold_', 'enemy_sp_soul_', 'boss_sp_soul_', 'enemy_sp_evo_', 'boss_sp_evo_', 'enemy_sp_rift_', 'boss_sp_rift_'] as const;

function enemy(id: string) {
  const found = ENEMIES.find((candidate) => candidate.enemyId === id);
  assert.ok(found, `missing runtime enemy ${id}`);
  return found;
}

test('canonical periodic resource execution contains eighteen stages and twenty-four dedicated enemies', () => {
  const stages = SPECIAL_STAGES.filter((stage) => PERIODIC_STAGE_PREFIXES.some((prefix) => stage.id.startsWith(prefix)));
  const enemies = ENEMIES.filter((candidate) => PERIODIC_ENEMY_PREFIXES.some((prefix) => candidate.enemyId.startsWith(prefix)));
  assert.equal(stages.length, 18);
  assert.equal(enemies.length, 24);
  assert.equal(ENEMIES.length, 80);
  assert.equal(getStage('special_gold_convoy_01').mapLength, 1900);
  assert.equal(getStage('special_gold_convoy_05').enemyBaseHp, 9500);
  assert.equal(getStage('special_soul_forge_04').difficulty, 7);
  assert.equal(getStage('special_evolution_gate_05').difficulty, 8);
  assert.equal(getStage('special_starlight_rift_04').mapLength, 2850);
});

test('periodic bosses retain deterministic authored attack loops and gatekeeper push', () => {
  assert.equal(enemy('boss_sp_gold_carrier').definition.attackPattern?.length, 3);
  assert.deepEqual(enemy('boss_sp_gold_carrier').definition.attackPattern?.map((step) => step.attackDamage), [420, 420, 230]);
  assert.deepEqual(enemy('boss_sp_soul_grand_forge').definition.attackPattern?.map((step) => step.attackDamage), [260, 145, 260, 260, 145]);
  assert.equal(enemy('boss_sp_evo_gatekeeper').definition.attackPattern?.length, 4);
  assert.deepEqual(enemy('boss_sp_evo_gatekeeper').definition.attackPattern?.[2]?.onHitPush, { chancePermille: 1000, distance: 80, frames: 18 });
  assert.deepEqual(enemy('boss_sp_rift_nightfall').definition.attackPattern?.map((step) => step.attackDamage), [240, 115, 240, 410]);
});

test('periodic stages use collection charge and boss-threshold reinforcement where authored', () => {
  const periodicStages = SPECIAL_STAGES.filter((stage) => PERIODIC_STAGE_PREFIXES.some((prefix) => stage.id.startsWith(prefix)));
  assert.ok(periodicStages.every((stage) => stage.rewardChargePolicy === 'COLLECTION_CHARGE'));
  const goldV = getStage('special_gold_convoy_05');
  assert.ok(goldV.waves.some((wave) => wave.trigger.type === 'BOSS_HP_BELOW'));
  const evoV = getStage('special_evolution_gate_05');
  assert.ok(evoV.waves.filter((wave) => wave.trigger.type === 'BOSS_HP_BELOW').length >= 2);
});
