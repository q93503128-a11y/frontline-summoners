import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEMIES, createPrototypeBattle, getStageKillSupplyMultiplierPermille, getStage } from '../src/prototype.ts';

test('client runtime applies canonical phase/per-hit grammar to late main bosses', () => {
  const archmagus = ENEMIES.find((enemy) => enemy.enemyId === 'boss_ch3_archmagus')!.definition;
  const belzar = ENEMIES.find((enemy) => enemy.enemyId === 'boss_ch3_belzar')!.definition;
  const zero = ENEMIES.find((enemy) => enemy.enemyId === 'boss_ch4_zero_engine')!.definition;

  assert.deepEqual(archmagus.attackPhases?.map((phase) => phase.patternIndices), [[0], [0, 0, 1]]);
  assert.deepEqual(archmagus.attackPattern?.[0]?.hitDamages, [147, 273]);
  assert.deepEqual(belzar.hitDamages, [105, 105, 210]);
  assert.equal(belzar.hitEffects?.[2]?.onHitPush?.chancePermille, 350);
  assert.deepEqual(zero.attackPhases?.map((phase) => phase.patternIndices), [
    [0, 0, 1, 0, 2],
    [0, 3, 2, 0, 3],
    [2, 0, 3, 2],
  ]);
  assert.deepEqual(zero.attackPattern?.[2]?.hitDamages, [90, 113, 247]);
});

test('chapter one supply-route stage executes its authored +5% kill supply rule', () => {
  const stage = getStage('main_01_009');
  assert.equal(getStageKillSupplyMultiplierPermille(stage), 1050);
  const battle = createPrototypeBattle(stage.id, ['militia']);
  assert.equal(battle.killSupplyMultiplierPermille, 1050);
});

test('ordinary stages retain the normal kill supply multiplier', () => {
  const stage = getStage('main_01_008');
  assert.equal(getStageKillSupplyMultiplierPermille(stage), 1000);
  assert.equal(createPrototypeBattle(stage.id, ['militia']).killSupplyMultiplierPermille, 1000);
});
