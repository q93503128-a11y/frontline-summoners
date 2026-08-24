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
  getTreasureIdsForClearedStages,
  getUnlockedSlotIds,
} from '../src/prototype.ts';

const STAGE_LIMITS = [
  { maxSeconds: 60, minBaseRatio: 0.50 },
  { maxSeconds: 90, minBaseRatio: 0.40 },
  { maxSeconds: 105, minBaseRatio: 0.35 },
  { maxSeconds: 120, minBaseRatio: 0.30 },
  { maxSeconds: 135, minBaseRatio: 0.25 },
] as const;

function targetableEnemyCount(state: ReturnType<typeof createPrototypeBattle>): number {
  return state.battle.units.filter((unit) =>
    unit.team === 'ENEMY' && unit.state !== 'DYING' && unit.state !== 'NATURAL_KNOCKBACK'
  ).length;
}

function autoPlayStage(stageIndex: number, clearedStageIds: readonly string[]) {
  const stage = STAGES[stageIndex]!;
  const unlockedSlotIds = getUnlockedSlotIds(clearedStageIds);
  const ownedTreasureIds = getTreasureIdsForClearedStages(clearedStageIds);
  const state = createPrototypeBattle(stage.id, unlockedSlotIds, ownedTreasureIds);
  const limit = STAGE_LIMITS[stageIndex]!;
  const maxTicks = limit.maxSeconds * 30;

  // Deterministic baseline player: use only units and permanent treasures genuinely earned at this point.
  // Expensive/newer units get first refusal, then cheaper units fill the frontline.
  const slotPriority = [...state.playerSlots].sort((a, b) => b.cost - a.cost || a.slotId.localeCompare(b.slotId));

  for (let step = 0; step < maxTicks && state.battle.winner === null; step += 1) {
    for (const slot of slotPriority) trySpawnPlayerUnit(state, slot.slotId);

    const enemies = targetableEnemyCount(state);
    const baseRatio = state.battle.bases.PLAYER.hp / state.battle.bases.PLAYER.maxHp;
    if (getBaseWeaponCooldownRemaining(state) === 0 && (enemies >= 2 || (enemies >= 1 && baseRatio < 0.75))) {
      tryFireBaseWeapon(state);
    }

    stepPlayableBattle(state);
  }

  return { state, limit, unlockedSlotIds, ownedTreasureIds };
}

test('stages one through five are beatable in the real sequential unlock and treasure order', () => {
  const clearedStageIds: string[] = [];

  for (let stageIndex = 0; stageIndex < 5; stageIndex += 1) {
    const stage = STAGES[stageIndex]!;
    const { state, limit, unlockedSlotIds, ownedTreasureIds } = autoPlayStage(stageIndex, clearedStageIds);
    assert.equal(ownedTreasureIds.length, clearedStageIds.length, 'baseline must use exactly the treasures earned from prior clears');

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
    ['militia', 'guard', 'hunter', 'duelist'],
    'ST1~ST5 baseline must not accidentally use later campaign units',
  );
});
