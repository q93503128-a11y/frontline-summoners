import assert from 'node:assert/strict';
import test from 'node:test';
import { getBaseWeaponCooldownRemaining, stepPlayableBattle, tryFireBaseWeapon, trySpawnPlayerUnit } from '@frontline/sim/playable';
import { STARTER_SLOT_ID, STAGES, createPrototypeBattle } from '../src/prototype.ts';

test('stage one starts with exactly one militia worth of supply and remains a readable fresh-account win', () => {
  const stage = STAGES[0]!;
  const state = createPrototypeBattle(stage.id, [STARTER_SLOT_ID]);
  const hardTimeoutTicks = 30 * 90;

  assert.equal(state.supply, 50);
  assert.equal(state.playerSlots.length, 1);
  assert.equal(state.playerSlots[0]?.slotId, STARTER_SLOT_ID);
  assert.equal(state.playerSlots[0]?.cost, 50);

  const firstSpawn = trySpawnPlayerUnit(state, STARTER_SLOT_ID);
  assert.equal(firstSpawn.ok, true);
  assert.equal(state.supply, 0);
  assert.deepEqual(trySpawnPlayerUnit(state, STARTER_SLOT_ID), { ok: false, reason: 'insufficient_supply' });

  for (let step = 0; step < hardTimeoutTicks && state.battle.winner === null; step += 1) {
    trySpawnPlayerUnit(state, STARTER_SLOT_ID);
    const targetableEnemies = state.battle.units.filter((unit) => unit.team === 'ENEMY' && unit.state !== 'DYING' && unit.state !== 'NATURAL_KNOCKBACK').length;
    if (targetableEnemies >= 3 && getBaseWeaponCooldownRemaining(state) === 0) tryFireBaseWeapon(state);
    stepPlayableBattle(state);
  }

  assert.equal(state.battle.winner, 'PLAYER', `fresh-account stage one failed to resolve as a player win by tick ${state.battle.tick}`);
  assert.ok(state.battle.tick <= 30 * 90, `stage one tutorial baseline took too long: ${(state.battle.tick / 30).toFixed(1)}s`);
  assert.ok(state.battle.bases.PLAYER.hp >= Math.floor(state.battle.bases.PLAYER.maxHp * 0.35), `starter baseline left the player base too damaged: ${state.battle.bases.PLAYER.hp}/${state.battle.bases.PLAYER.maxHp}`);
});