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

const FINAL_LIMITS = [
  { maxSeconds: 300, minBaseRatio: 0.03 },
  { maxSeconds: 315, minBaseRatio: 0.03 },
  { maxSeconds: 330, minBaseRatio: 0.02 },
  { maxSeconds: 360, minBaseRatio: 0.01 },
  { maxSeconds: 420, minBaseRatio: 0.01 },
] as const;

const EXPECTED_ROSTER_SIZE_BEFORE_STAGE = [8, 9, 9, 9, 9] as const;

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
  const limit = FINAL_LIMITS[stageIndex - 15]!;
  const maxTicks = limit.maxSeconds * 30;
  const slotPriority = [...state.playerSlots].sort((a, b) => b.cost - a.cost || a.slotId.localeCompare(b.slotId));
  const seenEnemyIds = new Set<string>();

  for (let step = 0; step < maxTicks && state.battle.winner === null; step += 1) {
    for (const slot of slotPriority) trySpawnPlayerUnit(state, slot.slotId);

    const enemies = targetableEnemyCount(state);
    const baseRatio = state.battle.bases.PLAYER.hp / state.battle.bases.PLAYER.maxHp;
    if (getBaseWeaponCooldownRemaining(state) === 0 && (enemies >= 3 || (enemies >= 1 && baseRatio < 0.75))) {
      tryFireBaseWeapon(state);
    }

    stepPlayableBattle(state);
    for (const unit of state.battle.units) {
      if (unit.team === 'ENEMY') seenEnemyIds.add(unit.definition.id);
    }
  }

  return { state, limit, unlockedSlotIds, ownedTreasureIds, seenEnemyIds };
}

test('stages sixteen through twenty stay beatable in exact unlock/treasure order and final bosses actually appear', () => {
  const clearedStageIds = STAGES.slice(0, 15).map((stage) => stage.id);
  assert.deepEqual(
    getUnlockedSlotIds(clearedStageIds),
    ['militia', 'guard', 'hunter', 'duelist', 'lancer', 'battlemage', 'pyromancer', 'royal'],
  );

  for (let stageIndex = 15; stageIndex < 20; stageIndex += 1) {
    const stage = STAGES[stageIndex]!;
    const { state, limit, unlockedSlotIds, ownedTreasureIds, seenEnemyIds } = autoPlayStage(stageIndex, clearedStageIds);
    assert.equal(ownedTreasureIds.length, clearedStageIds.length, 'final baseline must not receive a treasure before its stage is cleared');

    assert.equal(
      unlockedSlotIds.length,
      EXPECTED_ROSTER_SIZE_BEFORE_STAGE[stageIndex - 15],
      `STAGE ${stageIndex + 1} started with the wrong number of legitimately unlocked units`,
    );

    if (stageIndex === 15) {
      assert.ok(!unlockedSlotIds.includes('heretic'), 'heretic must not be usable until STAGE 16 is cleared');
    } else {
      assert.ok(unlockedSlotIds.includes('heretic'), 'heretic must be usable from STAGE 17 onward');
    }
    assert.ok(!unlockedSlotIds.includes('voidsage'), 'voidsage is the STAGE 20 clear reward and must never be usable during chapter 1');

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

    if (stageIndex === 18) {
      assert.ok(seenEnemyIds.has('enemy-boss'), 'STAGE 19 must not be clearable before the golden-mask boss actually appears');
    }
    if (stageIndex === 19) {
      assert.ok(seenEnemyIds.has('enemy-boss'), 'STAGE 20 must spawn the golden-mask boss before victory');
      assert.ok(seenEnemyIds.has('enemy-boss-iron'), 'STAGE 20 must spawn the iron general before victory');
    }

    clearedStageIds.push(stage.id);
  }

  assert.deepEqual(
    getUnlockedSlotIds(clearedStageIds),
    ['militia', 'guard', 'hunter', 'duelist', 'lancer', 'battlemage', 'pyromancer', 'royal', 'heretic', 'voidsage'],
    'clearing ST20 must leave the whole 10-unit prototype roster unlocked',
  );
});
