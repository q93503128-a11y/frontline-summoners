import assert from 'node:assert/strict';
import test from 'node:test';
import { CombatAttribute, CombatTag, UnitState, createBattle, spawnUnit, stepBattle, type BattleUnitDefinition } from '../src/index.ts';
import {
  BELL_CRAB_CHARACTER_ID,
  CLOCKDUCK_CHARACTER_ID,
  TURNIP_RIDER_CHARACTER_ID,
  captureCombatQuirkFrame,
  resolveCombatQuirkFacts,
} from '../src/combat-quirk-attribution.ts';

const unit = (id: string, overrides: Partial<BattleUnitDefinition> = {}): BattleUnitDefinition => ({
  id,
  maxHp: 100,
  attackDamage: 20,
  moveSpeed: 0,
  standingRange: 200,
  attackMinRange: 0,
  attackMaxRange: 200,
  targetMode: 'SINGLE',
  naturalKnockbackCount: 0,
  naturalKnockbackFrames: 12,
  naturalKnockbackDistance: 30,
  deathFrames: 12,
  attackTiming: { cycleFrames: 30, hitFrames: [1], backswingFrames: 6 },
  attributes: [CombatAttribute.Neutral],
  combatTags: [],
  damageBonuses: [],
  ...overrides,
});

function observeOneStep(state: ReturnType<typeof createBattle>) {
  const capture = captureCombatQuirkFrame(state);
  stepBattle(state);
  return resolveCombatQuirkFacts(capture, state);
}

test('five living turnip riders trigger the hidden formation fact', () => {
  const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  for (let index = 0; index < 5; index += 1) {
    spawnUnit(state, unit(TURNIP_RIDER_CHARACTER_ID, { attackDamage: 0 }), 'PLAYER', 100 + index * 10);
  }
  assert.ok(observeOneStep(state).includes('quirk_turnip_five'));
});

test('bell crab must connect one area hit with at least three unit targets', () => {
  const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const crab = spawnUnit(state, unit(BELL_CRAB_CHARACTER_ID, { targetMode: 'AREA', attackDamage: 10 }), 'PLAYER', 400);
  crab.state = UnitState.Foreswing;
  crab.stateFrame = 0;
  crab.nextAttackTick = 30;
  for (const x of [450, 500, 550]) spawnUnit(state, unit(`enemy-${x}`, { attackDamage: 0 }), 'ENEMY', x);
  assert.ok(observeOneStep(state).includes('quirk_bellcrab_multi'));
});

test('bell crab does not trigger on only two targets', () => {
  const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const crab = spawnUnit(state, unit(BELL_CRAB_CHARACTER_ID, { targetMode: 'AREA', attackDamage: 10 }), 'PLAYER', 400);
  crab.state = UnitState.Foreswing;
  crab.stateFrame = 0;
  crab.nextAttackTick = 30;
  for (const x of [450, 500]) spawnUnit(state, unit(`enemy-${x}`, { attackDamage: 0 }), 'ENEMY', x);
  assert.ok(!observeOneStep(state).includes('quirk_bellcrab_multi'));
});

test('clockduck independently lethal hit on a MACHINE BOSS triggers finishing fact', () => {
  const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const duck = spawnUnit(state, unit(CLOCKDUCK_CHARACTER_ID, { attackDamage: 80 }), 'PLAYER', 400);
  duck.state = UnitState.Foreswing;
  duck.stateFrame = 0;
  duck.nextAttackTick = 30;
  const boss = spawnUnit(state, unit('machine-boss', {
    maxHp: 70,
    attackDamage: 0,
    attributes: [CombatAttribute.Machine],
    combatTags: [CombatTag.Boss],
  }), 'ENEMY', 450);
  const facts = observeOneStep(state);
  assert.equal(boss.state, UnitState.Dying);
  assert.ok(facts.includes('quirk_duck_mech_finish'));
});

test('clockduck does not receive finishing credit when its own hit is not independently lethal', () => {
  const state = createBattle({ mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000 });
  const duck = spawnUnit(state, unit(CLOCKDUCK_CHARACTER_ID, { attackDamage: 20 }), 'PLAYER', 400);
  duck.state = UnitState.Foreswing;
  duck.stateFrame = 0;
  duck.nextAttackTick = 30;
  const helper = spawnUnit(state, unit('helper', { attackDamage: 100 }), 'PLAYER', 400);
  helper.state = UnitState.Foreswing;
  helper.stateFrame = 0;
  helper.nextAttackTick = 30;
  const boss = spawnUnit(state, unit('machine-boss', {
    maxHp: 100,
    attackDamage: 0,
    attributes: [CombatAttribute.Machine],
    combatTags: [CombatTag.Boss],
  }), 'ENEMY', 450);
  const facts = observeOneStep(state);
  assert.equal(boss.state, UnitState.Dying);
  assert.ok(!facts.includes('quirk_duck_mech_finish'));
});
