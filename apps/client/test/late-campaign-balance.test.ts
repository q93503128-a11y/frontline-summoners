import assert from 'node:assert/strict';
import test from 'node:test';
import { STAGES, getUnlockedSlotIds } from '../src/prototype.ts';
import { autoPlayCampaignStage } from './campaign-baseline.ts';

const LATE_LIMITS = [
  { maxSeconds: 255, minBaseRatio: 0.06 },
  { maxSeconds: 270, minBaseRatio: 0.05 },
  { maxSeconds: 285, minBaseRatio: 0.04 },
  { maxSeconds: 300, minBaseRatio: 0.03 },
  { maxSeconds: 315, minBaseRatio: 0.03 },
] as const;

const EXPECTED_ROSTER_SIZE_BEFORE_STAGE = [7, 7, 7, 8, 8] as const;

test('stages eleven through fifteen remain beatable without future unlocks or future treasures', () => {
  const clearedStageIds = STAGES.slice(0, 10).map((stage) => stage.id);
  assert.deepEqual(
    getUnlockedSlotIds(clearedStageIds),
    ['militia', 'guard', 'hunter', 'duelist', 'lancer', 'battlemage', 'pyromancer'],
  );

  for (let stageIndex = 10; stageIndex < 15; stageIndex += 1) {
    const stage = STAGES[stageIndex]!;
    const limit = LATE_LIMITS[stageIndex - 10]!;
    const { state, unlockedSlotIds, ownedTreasureIds, targetSupplyLevel } = autoPlayCampaignStage(stageIndex, clearedStageIds, {
      maxSeconds: limit.maxSeconds,
      cannonBaseRatio: 0.72,
    });

    assert.equal(ownedTreasureIds.length, clearedStageIds.length, 'late baseline must apply only already-earned treasures');
    assert.equal(targetSupplyLevel, 2, 'mid/late chapter economy baseline should invest into at least wallet Lv2');
    assert.equal(
      unlockedSlotIds.length,
      EXPECTED_ROSTER_SIZE_BEFORE_STAGE[stageIndex - 10],
      `STAGE ${stageIndex + 1} started with the wrong number of legitimately unlocked units`,
    );

    if (stageIndex <= 12) assert.ok(!unlockedSlotIds.includes('royal'), 'royal must not be usable before clearing STAGE 13');
    else assert.ok(unlockedSlotIds.includes('royal'), 'royal must be usable from STAGE 14 onward');

    assert.equal(
      state.battle.winner,
      'PLAYER',
      `STAGE ${stageIndex + 1} (${stage.id}) failed with legitimately unlocked slots: ${unlockedSlotIds.join(', ')}`,
    );
    assert.ok(state.battle.tick <= limit.maxSeconds * 30, `STAGE ${stageIndex + 1} exceeded ${limit.maxSeconds}s baseline: ${state.battle.tick} ticks`);

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