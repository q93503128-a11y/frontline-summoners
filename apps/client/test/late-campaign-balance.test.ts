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

const LATE_LIMITS = [
  { maxSeconds: 225, minBaseRatio: 0.08 },
  { maxSeconds: 240, minBaseRatio: 0.07 },
  { maxSeconds: 255, minBaseRatio: 0.06 },
  { maxSeconds: 270, minBaseRatio: 0.05 },
  { maxSeconds: 285, minBaseRatio: 0.04 },
] as const;

const EXPECTED_ROSTER_SIZE_BEFORE_STAGE = [7, 7, 7, 8, 8] as const;

function targetableEnemyCount(state: ReturnType<typeof createPrototypeBattle>): number {
  return state.battle.units.filter((unit) =>
    unit.team === 'ENEMY' && unit.state !== 'DYING' && unit.state !== 'NATURAL_KNOCKBACK'
  ).length;
}

function autoPlayStage(stageIndex: number, clearedStageIds: readonly string[]) {
  const stage = STAGES[stageIndex]!;
  const unlockedSlotIds = getUnlockedSlotIds(clearedStageIds);
  const state = createPrototypeBattle(stage.id, unlockedSlotIds);
  const limit = LATE_LIMITS[stageIndex - 10]!;
  const maxTicks = limit.maxSeconds * 30;
  const slotPriority = [...state.playerSlots].sort((a, b) => b.cost - a.cost || a.slotId.localeCompare(b.slotId));

  for (let step = 0; step < maxTicks && state.battle.winner === null; step += 1) {
    for (const slot of slotPriority) trySpawnPlayerUnit(state, slot.slotId);

    const enemies = targetableEnemyCount(state);
    const baseRatio = state.battle.bases.PLAYER.hp / state.battle.bases.PLAYER.maxHp;
    if (getBaseWeaponCooldownRemaining(state) === 0 && (enemies >= 3 || (enemies >= 1 && baseRatio < 0.72))) {
      tryFireBaseWeapon(state);
    }

    stepPlayableBattle(state);
  }

  return { state, limit, unlockedSlotIds };
}

test('stages eleven through fifteen remain beatable without using future unlocks', () => {
  const clearedStageIds = STAGES.slice(0, 10).map((stage) => stage.id);
  assert.deepEqual(
    getUnlockedSlotIds(clearedStageIds),
    ['militia', 'guard', 'hunter', 'duelist', 'lancer', 'battlemage', 'pyromancer'],
  );

  for (let stageIndex = 10; stageIndex < 15; stageIndex += 1) {
    const stage = STAGES[stageIndex]!;
    const { state, limit, unlockedSlotIds } = autoPlayStage(stageIndex, clearedStageIds);
    assert.equal(
      unlockedSlotIds.length,
      EXPECTED_ROSTER_SIZE_BEFORE_STAGE[stageIndex - 10],
      `STAGE ${stageIndex + 1} started with the wrong number of legitimately unlocked units`,
    );

    if (stageIndex <= 12) {
      assert.ok(!unlockedSlotIds.includes('royal'), `royal must not be usable before clearing STAGE 13`);
    } else {
      assert.ok(unlockedSlotIds.includes('royal'), `royal must be usable from STAGE 14 onward`);
    }

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
    ['militia', 'guard', 'hunter', 'duelist', 'lancer', 'battlemage', 'pyromancer', 'royal'],
    'ST11~ST15 must add only royal at the ST13 milestone',
  );
});
