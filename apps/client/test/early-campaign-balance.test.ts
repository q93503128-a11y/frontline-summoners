import assert from 'node:assert/strict';
import test from 'node:test';
import { STAGES, getUnlockedSlotIds } from '../src/prototype.ts';
import { autoPlayCampaignStage } from './campaign-baseline.ts';

const STAGE_LIMITS = [
  { maxSeconds: 90, minBaseRatio: 0.35 },
  { maxSeconds: 105, minBaseRatio: 0.30 },
  { maxSeconds: 120, minBaseRatio: 0.25 },
  { maxSeconds: 135, minBaseRatio: 0.20 },
  { maxSeconds: 150, minBaseRatio: 0.18 },
] as const;

test('stages one through five are beatable in the real sequential unlock and treasure order', () => {
  const clearedStageIds: string[] = [];

  for (let stageIndex = 0; stageIndex < 5; stageIndex += 1) {
    const stage = STAGES[stageIndex]!;
    const limit = STAGE_LIMITS[stageIndex]!;
    const { state, unlockedSlotIds, ownedTreasureIds, targetSupplyLevel } = autoPlayCampaignStage(stageIndex, clearedStageIds, {
      maxSeconds: limit.maxSeconds,
      cannonBaseRatio: 0.75,
      cannonEnemyCount: 2,
    });

    assert.equal(ownedTreasureIds.length, clearedStageIds.length, 'baseline must use exactly the treasures earned from prior clears');
    assert.equal(targetSupplyLevel, 1, 'the opening five stages must remain playable without mandatory wallet rushing');
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