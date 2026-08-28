import assert from 'node:assert/strict';
import test from 'node:test';
import type { BattleUnitDefinition } from '../src/index.ts';
import {
  applyCoopPlayableFrame,
  createCoopPlayableBattle,
  getCoopPlayableSnapshot,
  type CoopPlayableBattleConfig,
} from '../src/coop-playable.ts';

const unit = (id: string): BattleUnitDefinition => ({
  id,
  maxHp: 100,
  attackDamage: 10,
  moveSpeed: 1,
  standingRange: 40,
  attackMinRange: 0,
  attackMaxRange: 50,
  targetMode: 'SINGLE',
  naturalKnockbackCount: 1,
  naturalKnockbackFrames: 12,
  naturalKnockbackDistance: 20,
  deathFrames: 12,
  attackTiming: { cycleFrames: 30, hitFrames: [5], backswingFrames: 6 },
  attributes: ['NEUTRAL'],
  combatTags: [],
  damageBonuses: [],
});

const slot = (id: string) => ({
  slotId: id,
  displayName: id,
  definition: unit(id),
  cost: 50,
  rechargeFrames: 60,
});

const levelsA = [
  { incomePerSecond: 12, maxSupply: 1000, upgradeCost: 0 },
  { incomePerSecond: 20, maxSupply: 1400, upgradeCost: 140 },
] as const;
const levelsB = [
  { incomePerSecond: 12, maxSupply: 1000, upgradeCost: 0 },
  { incomePerSecond: 20, maxSupply: 1400, upgradeCost: 160 },
] as const;

function config(): CoopPlayableBattleConfig {
  return {
    mapLength: 1000,
    playerBaseHp: 1000,
    enemyBaseHp: 1000,
    players: { A: [slot('a')], B: [slot('b')] },
    playerEconomies: {
      A: { startingSupply: 150, supplyLevels: levelsA, enemyRewardSupplyById: { grunt: 40 } },
      B: { startingSupply: 100, supplyLevels: levelsB, enemyRewardSupplyById: { grunt: 10 } },
    },
    enemies: [{ enemyId: 'grunt', displayName: 'grunt', definition: unit('grunt'), rewardSupply: 25 }],
    enemyWaves: [{ id: 'W1', trigger: { type: 'TIME', frame: 0 }, spawn: { enemyId: 'grunt', count: 1, intervalFrames: 999, magnificationPermille: 1000 } }],
    baseWeapon: { damage: 200, cooldownFrames: 120, pushDistance: 60, pushFrames: 10 },
  };
}

test('co-op supports distinct starting supply and worker costs for each private economy', () => {
  const state = createCoopPlayableBattle(config());
  assert.equal(state.players.A.supply, 150);
  assert.equal(state.players.B.supply, 100);
  assert.equal(state.players.A.supplyLevels[1]?.upgradeCost, 140);
  assert.equal(state.players.B.supplyLevels[1]?.upgradeCost, 160);
});

test('authoritative snapshot exposes actual slot and next worker-upgrade costs per seat', () => {
  const snapshot = getCoopPlayableSnapshot(createCoopPlayableBattle(config()));
  const a = snapshot.players.find((player) => player.seatId === 'A')!;
  const b = snapshot.players.find((player) => player.seatId === 'B')!;
  assert.equal(a.costs.a, 50);
  assert.equal(b.costs.b, 50);
  assert.equal(a.nextSupplyUpgradeCost, 140);
  assert.equal(b.nextSupplyUpgradeCost, 160);
});

test('one enemy death grants each seat its own validated kill-supply amount', () => {
  const state = createCoopPlayableBattle(config());
  applyCoopPlayableFrame(state, 0, { A: [{ type: 'FIRE_BASE_WEAPON' }], B: [] });
  assert.equal(state.players.A.supply, 190);
  assert.equal(state.players.B.supply, 110);
});

test('per-seat progression economy participates in deterministic state hashing', () => {
  const first = createCoopPlayableBattle(config());
  const altered = config();
  const second = createCoopPlayableBattle({
    ...altered,
    playerEconomies: {
      ...altered.playerEconomies!,
      A: { ...altered.playerEconomies!.A, startingSupply: 151 },
    },
  });
  assert.notEqual(first.stateHash, second.stateHash);
});
