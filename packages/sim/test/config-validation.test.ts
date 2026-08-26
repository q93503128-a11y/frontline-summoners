import assert from 'node:assert/strict';
import test from 'node:test';
import type { BattleUnitDefinition } from '../src/index.ts';
import { createPlayableBattle, type PlayableBattleConfig } from '../src/playable.ts';

const fighter = (): BattleUnitDefinition => ({
  id: 'unit', maxHp: 100, attackDamage: 10, moveSpeed: 1,
  standingRange: 40, attackMinRange: 0, attackMaxRange: 50, targetMode: 'SINGLE',
  naturalKnockbackCount: 1, naturalKnockbackFrames: 12, naturalKnockbackDistance: 20,
  deathFrames: 12, attackTiming: { cycleFrames: 30, hitFrames: [5], backswingFrames: 6 },
  attributes: ['NEUTRAL'], combatTags: [], damageBonuses: [],
});

const base = (): PlayableBattleConfig => ({
  mapLength: 1000,
  playerBaseHp: 1000,
  enemyBaseHp: 1000,
  startingSupply: 300,
  playerSlots: [{ slotId: 'unit', displayName: 'unit', definition: fighter(), cost: 50, rechargeFrames: 60 }],
  enemies: [{ enemyId: 'enemy', displayName: 'enemy', definition: { ...fighter(), id: 'enemy' }, rewardSupply: 10 }],
  enemyWaves: [{
    id: 'W1',
    trigger: { type: 'TIME', frame: 30 },
    spawn: { enemyId: 'enemy', count: 1, intervalFrames: 30, magnificationPermille: 1000 },
  }],
});

test('playable config rejects invalid deployment caps and starting supply', () => {
  assert.throws(() => createPlayableBattle({ ...base(), playerUnitCap: 0 }), /playerUnitCap/);
  assert.throws(() => createPlayableBattle({ ...base(), enemyUnitCap: -1 }), /enemyUnitCap/);
  assert.throws(() => createPlayableBattle({ ...base(), startingSupply: -1 }), /startingSupply/);
});

test('playable config rejects broken supply-level definitions', () => {
  assert.throws(() => createPlayableBattle({
    ...base(), supplyLevels: [{ incomePerSecond: 65, maxSupply: 3000, upgradeCost: 1 }],
  }), /supplyLevels\[0\]\.upgradeCost/);
  assert.throws(() => createPlayableBattle({
    ...base(), supplyLevels: [
      { incomePerSecond: 65, maxSupply: 3000, upgradeCost: 0 },
      { incomePerSecond: 64, maxSupply: 3000, upgradeCost: 200 },
    ],
  }), /incomePerSecond must not decrease/);
  assert.throws(() => createPlayableBattle({
    ...base(), supplyLevels: [
      { incomePerSecond: 65, maxSupply: 3000, upgradeCost: 0 },
      { incomePerSecond: 70, maxSupply: 2999, upgradeCost: 200 },
    ],
  }), /maxSupply must not decrease/);
});

test('playable config rejects negative rewards and malformed weapon settings', () => {
  assert.throws(() => createPlayableBattle({
    ...base(), enemies: [{ enemyId: 'enemy', displayName: 'enemy', definition: { ...fighter(), id: 'enemy' }, rewardSupply: -1 }],
  }), /rewardSupply/);
  assert.throws(() => createPlayableBattle({
    ...base(), baseWeapon: { damage: 90, cooldownFrames: 0, pushDistance: 60, pushFrames: 10 },
  }), /cooldownFrames/);
  assert.throws(() => createPlayableBattle({
    ...base(), baseWeapon: { damage: 90, cooldownFrames: 900, pushDistance: -1, pushFrames: 10 },
  }), /pushDistance/);
});
