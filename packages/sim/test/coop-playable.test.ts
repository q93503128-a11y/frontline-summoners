import assert from 'node:assert/strict';
import test from 'node:test';
import type { BattleUnitDefinition } from '../src/index.ts';
import {
  applyCoopPlayableFrame,
  createCoopPlayableBattle,
  getCoopCooldownRemaining,
  getCoopPlayableSnapshot,
  tryFireCoopBaseWeapon,
  trySpawnCoopPlayerUnit,
  tryUpgradeCoopSupply,
  type CoopPlayableBattleConfig,
} from '../src/coop-playable.ts';

const unit = (id: string, overrides: Partial<BattleUnitDefinition> = {}): BattleUnitDefinition => ({
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
  ...overrides,
});

const slot = (slotId: string, cost = 50) => ({
  slotId,
  displayName: slotId,
  definition: unit(slotId),
  cost,
  rechargeFrames: 60,
});

const config = (): CoopPlayableBattleConfig => ({
  mapLength: 1000,
  playerBaseHp: 1000,
  enemyBaseHp: 1000,
  startingSupply: 300,
  players: {
    A: [slot('shared'), slot('a-only', 120)],
    B: [slot('shared'), slot('b-only', 120)],
  },
  enemies: [
    { enemyId: 'grunt', displayName: 'grunt', definition: unit('grunt'), rewardSupply: 25 },
  ],
  enemyWaves: [
    {
      id: 'W1',
      trigger: { type: 'TIME', frame: 0 },
      spawn: { enemyId: 'grunt', count: 1, intervalFrames: 999, magnificationPermille: 1000 },
    },
  ],
});

test('two players may bring the same canonical character while retaining private supply and cooldowns', () => {
  const state = createCoopPlayableBattle(config());
  const a = trySpawnCoopPlayerUnit(state, 'A', 'shared');
  const b = trySpawnCoopPlayerUnit(state, 'B', 'shared');
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(state.players.A.supply, 250);
  assert.equal(state.players.B.supply, 250);
  assert.equal(getCoopCooldownRemaining(state, 'A', 'shared'), 60);
  assert.equal(getCoopCooldownRemaining(state, 'B', 'shared'), 60);
  assert.equal(state.shared.battle.units.filter((candidate) => candidate.team === 'PLAYER').length, 2);
  assert.notEqual(a.ok && a.simulationId, b.ok && b.simulationId);
});

test('supply upgrades are private to each player', () => {
  const state = createCoopPlayableBattle({ ...config(), startingSupply: 1000 });
  assert.deepEqual(tryUpgradeCoopSupply(state, 'A'), { ok: true, level: 2 });
  assert.equal(state.players.A.supplyLevel, 2);
  assert.equal(state.players.A.supply, 840);
  assert.equal(state.players.B.supplyLevel, 1);
  assert.equal(state.players.B.supply, 1000);
});

test('shared base weapon has one cooldown authority across both players and records the activating seat', () => {
  const state = createCoopPlayableBattle({
    ...config(),
    baseWeapon: { damage: 10, cooldownFrames: 90, pushDistance: 30, pushFrames: 5 },
  });
  assert.deepEqual(tryFireCoopBaseWeapon(state, 'A'), { ok: true, readyTick: 90 });
  assert.deepEqual(tryFireCoopBaseWeapon(state, 'B'), { ok: false, reason: 'already_pending' });
  assert.equal(state.baseWeaponLastActivatedSeatId, 'A');
});

test('supply drop resolves only into the activating seat private economy at its authored hit frame', () => {
  const state = createCoopPlayableBattle({
    ...config(),
    baseWeapon: {
      id: 'base_weapon_supply_drop',
      kind: 'SUPPLY_DROP',
      damage: 0,
      cooldownFrames: 120,
      pushDistance: 0,
      pushFrames: 1,
      initialCooldownFrames: 0,
      hitDelayFrames: 2,
      supplyGainPermille: 180,
      supplyGainMin: 120,
      supplyGainMax: 900,
    },
  });
  const beforeA = state.players.A.supply;
  const beforeB = state.players.B.supply;
  const fired = applyCoopPlayableFrame(state, 0, {
    A: [{ type: 'FIRE_BASE_WEAPON' }],
    B: [{ type: 'FIRE_BASE_WEAPON' }],
  });
  assert.equal(fired.outcomes[0]?.ok, true);
  assert.equal(fired.outcomes[1]?.ok, false);
  assert.equal(state.baseWeaponPendingSupplySeatId, 'A');
  assert.equal(state.shared.supply, 0);
  applyCoopPlayableFrame(state, 1, { A: [], B: [] });
  assert.equal(state.players.A.supply - state.players.B.supply, beforeA - beforeB);
  applyCoopPlayableFrame(state, 2, { A: [], B: [] });
  assert.equal(state.players.A.supply - state.players.B.supply, 180);
  assert.equal(state.baseWeaponPendingSupplySeatId, null);
  assert.equal(state.shared.supply, 0, 'co-op supply drop must never write into the inert shared wallet');
  assert.equal(getCoopPlayableSnapshot(state).baseWeaponLastActivatedSeatId, 'A');
});

test('a committed frame applies A then B commands and advances the shared deterministic simulation exactly once', () => {
  const state = createCoopPlayableBattle(config());
  const result = applyCoopPlayableFrame(state, 0, {
    A: [{ type: 'SPAWN', slotId: 'shared' }],
    B: [{ type: 'SPAWN', slotId: 'shared' }],
  });
  assert.equal(result.outcomes.length, 2);
  assert.equal(result.outcomes.every((outcome) => outcome.ok), true);
  assert.equal(state.shared.battle.tick, 1);
  assert.equal(result.snapshot.tick, 1);
  assert.equal(result.snapshot.units.filter((candidate) => candidate.team === 'PLAYER').length, 2);
  assert.equal(result.snapshot.units.filter((candidate) => candidate.team === 'ENEMY').length, 1);
  assert.throws(() => applyCoopPlayableFrame(state, 0, { A: [], B: [] }), /does not match simulation tick/);
});

test('enemy kill supply is granted to both private economies without becoming a shared wallet', () => {
  const state = createCoopPlayableBattle({
    ...config(),
    baseWeapon: { damage: 200, cooldownFrames: 120, pushDistance: 60, pushFrames: 10 },
  });
  const result = applyCoopPlayableFrame(state, 0, {
    A: [{ type: 'FIRE_BASE_WEAPON' }],
    B: [],
  });
  assert.equal(result.snapshot.units.find((candidate) => candidate.team === 'ENEMY')?.state, 'DYING');
  // No spawn costs were paid. Each player gets 25 kill supply plus no full supply tick yet.
  assert.equal(state.players.A.supply, 325);
  assert.equal(state.players.B.supply, 325);
  assert.equal(state.shared.supply, 0, 'single-player economy field is intentionally inert in co-op');
});

test('co-op snapshots retain unit ownership while enemies remain team-owned', () => {
  const state = createCoopPlayableBattle(config());
  trySpawnCoopPlayerUnit(state, 'A', 'a-only');
  trySpawnCoopPlayerUnit(state, 'B', 'b-only');
  applyCoopPlayableFrame(state, 0, { A: [], B: [] });
  const snapshot = getCoopPlayableSnapshot(state);
  const playerOwners = snapshot.units.filter((candidate) => candidate.team === 'PLAYER').map((candidate) => candidate.ownerSeatId).sort();
  assert.deepEqual(playerOwners, ['A', 'B']);
  assert.equal(snapshot.units.find((candidate) => candidate.team === 'ENEMY')?.ownerSeatId, undefined);
});

test('identical co-op frame sequence yields identical hash', () => {
  const run = (): string => {
    const state = createCoopPlayableBattle(config());
    applyCoopPlayableFrame(state, 0, {
      A: [{ type: 'SPAWN', slotId: 'shared' }],
      B: [{ type: 'UPGRADE_SUPPLY' }],
    });
    for (let tick = 1; tick < 90; tick += 1) {
      applyCoopPlayableFrame(state, tick, { A: [], B: [] });
    }
    return state.stateHash;
  };
  assert.equal(run(), run());
});
