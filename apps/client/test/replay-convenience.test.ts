import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getReplayConvenienceState,
  hasStageNormalClear,
  resolveBattleSpeed,
  scaleReplayDeltaMs,
} from '../src/replay-convenience.ts';
import { SPECIAL_STAGES, STAGES, type PrototypeStage } from '../src/prototype.ts';
import type { GuestProgress } from '../src/save.ts';

const emptyProgress: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
};

test('replay convenience stays locked before an actual NORMAL_CLEAR', () => {
  const stage = STAGES[0]!;
  assert.equal(hasStageNormalClear(stage, emptyProgress), false);
  assert.deepEqual(getReplayConvenienceState(stage, emptyProgress), {
    speedUpUnlocked: false,
    sweepUnlocked: false,
  });
  assert.equal(resolveBattleSpeed(2, getReplayConvenienceState(stage, emptyProgress)), 1);
});

test('main NORMAL_CLEAR unlocks typed 2x and sweep convenience without inventing a new clear axis', () => {
  const stage = STAGES[0]!;
  const progress: GuestProgress = {
    ...emptyProgress,
    clearedStageIds: [stage.id],
    normalClearSourceByStage: { [stage.id]: 'SOLO_BATTLE' },
    permanentRewardIds: [stage.permanentRewardId!],
  };
  const convenience = getReplayConvenienceState(stage, progress);
  assert.equal(hasStageNormalClear(stage, progress), true);
  assert.deepEqual(convenience, { speedUpUnlocked: true, sweepUnlocked: true });
  assert.equal(resolveBattleSpeed(2, convenience), 2);
  assert.equal(resolveBattleSpeed(1, convenience), 1);
});

test('SPECIAL battle clears use the existing special clear record for replay convenience', () => {
  const stage = SPECIAL_STAGES[0]!;
  const progress: GuestProgress = {
    ...emptyProgress,
    clearedStageIds: STAGES.map((candidate) => candidate.id),
    specialClearedStageIds: [stage.id],
    permanentRewardIds: STAGES.flatMap((candidate) => candidate.permanentRewardId ? [candidate.permanentRewardId] : []),
  };
  assert.equal(hasStageNormalClear(stage, progress), true);
  assert.deepEqual(getReplayConvenienceState(stage, progress), {
    speedUpUnlocked: true,
    sweepUnlocked: true,
  });
});

test('NEVER policy remains authoritative even when the stage has already been cleared', () => {
  const base = STAGES[0]!;
  const stage: PrototypeStage = {
    ...base,
    speedUpEligibility: 'NEVER',
    sweepEligibility: 'NEVER',
  };
  const progress: GuestProgress = {
    ...emptyProgress,
    clearedStageIds: [stage.id],
    normalClearSourceByStage: { [stage.id]: 'SOLO_BATTLE' },
    permanentRewardIds: [stage.permanentRewardId!],
  };
  assert.deepEqual(getReplayConvenienceState(stage, progress), {
    speedUpUnlocked: false,
    sweepUnlocked: false,
  });
});

test('2x replay scales only the real-time delta offered to the fixed-step battle accumulator', () => {
  assert.equal(scaleReplayDeltaMs(1000 / 60, 1), 1000 / 60);
  assert.equal(scaleReplayDeltaMs(1000 / 60, 2), 2000 / 60);
  assert.equal(scaleReplayDeltaMs(-1, 2), 0);
  assert.equal(scaleReplayDeltaMs(Number.NaN, 2), 0);
});
