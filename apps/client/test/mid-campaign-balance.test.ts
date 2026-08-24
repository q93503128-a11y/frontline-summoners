import assert from 'node:assert/strict';
import test from 'node:test';
import { STAGES, getUnlockedSlotIds } from '../src/prototype.ts';
import { autoPlayCampaignStage } from './campaign-baseline.ts';

const MID_LIMITS = [
  { maxSeconds: 180, minBaseRatio: 0.15 },
  { maxSeconds: 195, minBaseRatio: 0.13 },
  { maxSeconds: 210, minBaseRatio: 0.11 },
  { maxSeconds: 225, minBaseRatio: 0.09 },
  { maxSeconds: 240, minBaseRatio: 0.08 },
] as const;

test('stages six through ten remain beatable in the real sequential unlock and treasure order', () => {
  const clearedStageIds = STAGES.slice(0, 5).map((stage) => stage.id);
  assert.deepEqual(getUnlockedSlotIds(clearedStageIds), ['militia', 'guard', 'hunter', 'duelist']);

  for (let stageIndex = 5; stageIndex < 10; stageIndex += 1) {
    const stage = STAGES[stageIndex]!;
    const limit = MID_LIMITS[stageIndex - 5]!;
    const { state, unlockedSlotIds, ownedTreasureIds, targetSupplyLevel } = autoPlayCampaignStage(stageIndex, clearedStageIds, {
      maxSeconds: limit.maxSeconds,
      cannonBaseRatio: 0.70,
    });

    assert.equal(ownedTreasureIds.length, clearedStageIds.length, 'mid baseline must not use future treasure rewards');
    assert.equal(targetSupplyLevel, stageIndex >= 7 ? 2 : 1);
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