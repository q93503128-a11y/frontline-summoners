import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnUnit, type BattleUnitDefinition } from '../src/index.ts';
import {
  AEGIS_EMITTER_BASE_WEAPON,
  FRONT_CANNON_BASE_WEAPON,
  SUPPLY_DROP_BASE_WEAPON,
  createPlayableBattle,
  getBaseWeaponCooldownRemaining,
  stepPlayableBattle,
  tryFireBaseWeapon,
  type EnemyArchetype,
  type PlayerRosterSlot,
} from '../src/playable.ts';

const fighter = (id: string, overrides: Partial<BattleUnitDefinition> = {}): BattleUnitDefinition => ({
  id, maxHp: 1000, attackDamage: 0, moveSpeed: 0, standingRange: 100,
  attackMinRange: 0, attackMaxRange: 100, targetMode: 'SINGLE', naturalKnockbackCount: 0,
  naturalKnockbackFrames: 1, naturalKnockbackDistance: 0, deathFrames: 12,
  attackTiming: { cycleFrames: 30, hitFrames: [1], backswingFrames: 0 },
  attributes: ['NEUTRAL'], combatTags: [], damageBonuses: [], ...overrides,
});
const slot: PlayerRosterSlot = { slotId: 'ally', displayName: 'ally', definition: fighter('ally'), cost: 0, rechargeFrames: 60 };
const enemies: readonly EnemyArchetype[] = [
  { enemyId: 'normal', displayName: 'normal', definition: fighter('normal'), rewardSupply: 100 },
];

function battle(baseWeapon = FRONT_CANNON_BASE_WEAPON) {
  return createPlayableBattle({
    mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000, startingSupply: 100,
    playerSlots: [slot], enemies, enemyWaves: [], baseWeapon,
  });
}

test('front cannon resolves at 24F, never damages enemy base, pushes boss less and structures not at all', () => {
  const state = battle(FRONT_CANNON_BASE_WEAPON);
  const normal = spawnUnit(state.battle, fighter('normal-target'), 'ENEMY', 500);
  const boss = spawnUnit(state.battle, fighter('boss-target', { combatTags: ['BOSS'] }), 'ENEMY', 520);
  const structure = spawnUnit(state.battle, fighter('structure-target', { combatTags: ['STRUCTURE'] }), 'ENEMY', 540);
  assert.equal(tryFireBaseWeapon(state).ok, true);
  for (let i = 0; i < 24; i += 1) stepPlayableBattle(state);
  assert.equal(normal.hp, 1000);
  assert.equal(state.battle.bases.ENEMY.hp, 1000);
  stepPlayableBattle(state);
  assert.equal(normal.hp, 910);
  assert.equal(boss.hp, 910);
  assert.equal(structure.hp, 910);
  assert.equal(normal.knockbackTargetX, 560);
  assert.equal(boss.knockbackTargetX, 540);
  assert.equal(structure.state, 'MOVING');
  assert.equal(state.battle.bases.ENEMY.hp, 1000);
});

test('aegis starts locked for 600F and snapshots only allies alive at activation', () => {
  const state = battle(AEGIS_EMITTER_BASE_WEAPON);
  const before = spawnUnit(state.battle, fighter('before'), 'PLAYER', 400);
  assert.equal(getBaseWeaponCooldownRemaining(state), 600);
  for (let i = 0; i < 600; i += 1) stepPlayableBattle(state);
  assert.equal(getBaseWeaponCooldownRemaining(state), 0);
  assert.equal(tryFireBaseWeapon(state).ok, true);
  const after = spawnUnit(state.battle, fighter('after'), 'PLAYER', 410);
  assert.equal(before.damageTakenPermille, 750);
  assert.equal(after.damageTakenPermille, 1000);
  assert.deepEqual(state.baseWeaponSnapshotSimulationIds, [before.simulationId]);
});

test('supply drop starts locked for 750F and resolves clamped gain at 30F', () => {
  const state = createPlayableBattle({
    mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000, startingSupply: 100,
    supplyLevels: [{ incomePerSecond: 0, maxSupply: 1000, upgradeCost: 0 }],
    playerSlots: [slot], enemies, enemyWaves: [], baseWeapon: SUPPLY_DROP_BASE_WEAPON,
  });
  for (let i = 0; i < 750; i += 1) stepPlayableBattle(state);
  assert.equal(tryFireBaseWeapon(state).ok, true);
  for (let i = 0; i < 30; i += 1) stepPlayableBattle(state);
  assert.equal(state.supply, 100);
  stepPlayableBattle(state);
  assert.equal(state.supply, 280, '18% of 1000 is 180');
});

test('kill supply multiplier scales stage death rewards deterministically', () => {
  const rewardEnemy = fighter('reward', { maxHp: 1 });
  const state = createPlayableBattle({
    mapLength: 1000, playerBaseHp: 1000, enemyBaseHp: 1000, startingSupply: 100,
    supplyLevels: [{ incomePerSecond: 0, maxSupply: 1000, upgradeCost: 0 }],
    playerSlots: [slot], enemies: [{ enemyId: 'reward', displayName: 'reward', definition: rewardEnemy, rewardSupply: 100 }],
    enemyWaves: [], killSupplyMultiplierPermille: 1050,
    baseWeapon: { ...FRONT_CANNON_BASE_WEAPON, hitDelayFrames: 0, damage: 90 },
  });
  const spawned = spawnUnit(state.battle, rewardEnemy, 'ENEMY', 500);
  state.rewardBySimulationId[spawned.simulationId] = 100;
  assert.equal(tryFireBaseWeapon(state).ok, true);
  stepPlayableBattle(state);
  assert.equal(state.supply, 205);
});
