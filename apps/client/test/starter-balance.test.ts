import assert from 'node:assert/strict';
import test from 'node:test';
import { getBaseWeaponCooldownRemaining, stepPlayableBattle, tryFireBaseWeapon, trySpawnPlayerUnit } from '@frontline/sim/playable';
import { STARTER_SLOT_ID, STAGES, createPrototypeBattle } from '../src/prototype.ts';

test('stage one is beatable from a fresh account with only the starter unit', () => {
  const stage = STAGES[0]!;
  const state = createPrototypeBattle(stage.id, [STARTER_SLOT_ID]);
  const maxTicks = 30 * 60 * 6;

  for (let step = 0; step < maxTicks && state.battle.winner === null; step += 1) {
    trySpawnPlayerUnit(state, STARTER_SLOT_ID);
    const targetableEnemies = state.battle.units.filter((unit) => unit.team === 'ENEMY' && unit.state !== 'DYING' && unit.state !== 'NATURAL_KNOCKBACK').length;
    if (targetableEnemies >= 3 && getBaseWeaponCooldownRemaining(state) === 0) tryFireBaseWeapon(state);
    stepPlayableBattle(state);
  }

  assert.equal(state.battle.winner, 'PLAYER', `fresh-account stage one failed to resolve as a player win by tick ${state.battle.tick}`);
  assert.equal(state.playerSlots.length, 1);
  assert.equal(state.playerSlots[0]?.slotId, STARTER_SLOT_ID);
});
