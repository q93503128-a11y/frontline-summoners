import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBaseWeaponCooldownRemaining,
  stepPlayableBattle,
  tryFireBaseWeapon,
  trySpawnPlayerUnit,
} from '@frontline/sim/playable';
import {
  STAGES,
  createPrototypeBattle,
  getUnlockedSlotIds,
} from '../src/prototype.ts';

const MID_LIMITS = [
  { maxSeconds: 150, minBaseRatio: 0.20 },
  { maxSeconds: 165, minBaseRatio: 0.18 },
  { maxSeconds: 180, minBaseRatio: 0.15 },
  { maxSeconds: 195, minBaseRatio: 0.12 },
  { maxSeconds: 210, minBaseRatio: 0.10 },
] as const;

function targetableEnemyCount(state: ReturnType<typeof createPrototypeBattle>): number {
  return state.battle.units.filter((unit) =>
    unit.team === 'ENEMY' && unit.state !== 'DYING' && unit.state !== 'NATURAL_KNOCKBACK'
  ).length;
}

function autoPlayStage(stageIndex: number, clearedStageIds: readonly string[]) {
  const stage = STAGES[stageIndex]!;
  const unlockedSlotIds = getUnlockedSlotIds(clearedStageIds);
  const state = createPrototypeBattle(stage.id, unlockedSlotIds);
  const limit = MID_LIMITS[stageIndex - 5]!;
  const maxTicks = limit.maxSeconds * 30;
  const slotPriority = [...state.playerSlots].sort((a, b) => b.cost - a.cost || a.slotId.localeCompare(b.slotId));

  for (let step = 0; step < maxTicks && state.battle.winner === null; step += 1) {
    // A deliberately simple deterministic baseline: it does not know enemy traits,
    // future waves, or unlocks. It simply attempts every legitimately-owned unit.
    for (const slot of slotPriority) trySpawnPlayerUnit(state, slot.slotId);

    const enemies = targetableEnemyCount(state);
    const baseRatio = state.battle.bases.PLAYER.hp / state.battle.bases.PLAYER.maxHp;
    if (getBaseWeaponCooldownRemaining(state) === 0 && (enemies >= 3 || (enemies >= 1 && baseRatio < 0.70))) {
      tryFireBaseWeapon(state);
    }

    stepPlayableBattle(state);
  }

  return { state, limit, unlockedSlotIds };
}

test('stages six through ten remain beatable in the real sequential unlock order', () => {
  const clearedStageIds = STAGES.slice(0, 5).map((stage) => stage.id);
  assert.deepEqual(getUnlockedSlotIds(clearedStageIds), ['militia', 'guard', 'hunter', 'duelist']);

  for (let stageIndex = 5; stageIndex < 10; stageIndex += 1) {
    const stage = STAGES[stageIndex]!;
    const { state, limit, unlockedSlotIds } = autoPlayStage(stageIndex, clearedStageIds);

    assert.equal(
      state.battle.winner,
      'PLAYER',
      `STAGE ${stageIndex + 1} (${stage.id}) failed with legitimately unlocked slots: ${unlockedSlotIds.join(', ')}`,
    );
    assert.ok(
      state.battle.tick <= limit.maxSeconds * 30,
      `STAGE ${stageIndex + 1} exceeded ${limit.maxSeconds}s baseline: ${state.battle.tick} ticks`,
    );

    const baseRatio = state.battle.bases.PLAYER.hp / state.battle.bases.PLAYER.maxHp;
    assert.ok(
      baseRatio >= limit.minBaseRatio,
      `STAGE ${stageIndex + 1} left player base at ${(baseRatio * 100).toFixed(1)}%, expected >= ${limit.minBaseRatio * 100}%`,
    );

    clearedStageIds.push(stage.id);
  }

  assert.deepEqual(
    getUnlockedSlotIds(clearedStageIds),
    ['militia', 'guard', 'hunter', 'duelist', 'lancer', 'battlemage', 'pyromancer'],
    'ST6~ST10 baseline must unlock lancer, battlemage, then pyromancer at the intended milestones',
  );
});
