import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getNextBattleSpeed,
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

test('2x is available before NORMAL_CLEAR while 3x and sweep remain locked', () => {
  const stage = STAGES[0]!;
  const convenience = getReplayConvenienceState(stage, emptyProgress);
  assert.equal(hasStageNormalClear(stage, emptyProgress), false);
  assert.deepEqual(convenience, {
    maxBattleSpeed: 2,
    tripleSpeedUnlocked: false,
    sweepUnlocked: false,
  });
  assert.equal(resolveBattleSpeed(1, convenience), 1);
  assert.equal(resolveBattleSpeed(2, convenience), 2);
  assert.equal(resolveBattleSpeed(3, convenience), 2);
  assert.equal(getNextBattleSpeed(1, convenience), 2);
  assert.equal(getNextBattleSpeed(2, convenience), 1);
});

test('main NORMAL_CLEAR unlocks typed 3x and sweep convenience without inventing a new clear axis', () => {
  const stage = STAGES[0]!;
  const progress: GuestProgress = {
    ...emptyProgress,
    clearedStageIds: [stage.id],
    normalClearSourceByStage: { [stage.id]: 'SOLO_BATTLE' },
    permanentRewardIds: [stage.permanentRewardId!],
  };
  const convenience = getReplayConvenienceState(stage, progress);
  assert.equal(hasStageNormalClear(stage, progress), true);
  assert.deepEqual(convenience, { maxBattleSpeed: 3, tripleSpeedUnlocked: true, sweepUnlocked: true });
  assert.equal(resolveBattleSpeed(3, convenience), 3);
  assert.equal(resolveBattleSpeed(2, convenience), 2);
  assert.equal(resolveBattleSpeed(1, convenience), 1);
  assert.equal(getNextBattleSpeed(1, convenience), 2);
  assert.equal(getNextBattleSpeed(2, convenience), 3);
  assert.equal(getNextBattleSpeed(3, convenience), 1);
});

test('SPECIAL battle clears use the existing special clear record for the 3x tier and sweep convenience', () => {
  const stage = SPECIAL_STAGES[0]!;
  const progress: GuestProgress = {
    ...emptyProgress,
    clearedStageIds: STAGES.map((candidate) => candidate.id),
    specialClearedStageIds: [stage.id],
    permanentRewardIds: STAGES.flatMap((candidate) => candidate.permanentRewardId ? [candidate.permanentRewardId] : []),
  };
  assert.equal(hasStageNormalClear(stage, progress), true);
  assert.deepEqual(getReplayConvenienceState(stage, progress), {
    maxBattleSpeed: 3,
    tripleSpeedUnlocked: true,
    sweepUnlocked: true,
  });
});

test('NEVER speed policy blocks only the 3x tier; baseline 2x remains available', () => {
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
  const convenience = getReplayConvenienceState(stage, progress);
  assert.deepEqual(convenience, {
    maxBattleSpeed: 2,
    tripleSpeedUnlocked: false,
    sweepUnlocked: false,
  });
  assert.equal(resolveBattleSpeed(2, convenience), 2);
  assert.equal(resolveBattleSpeed(3, convenience), 2);
});

test('1x, 2x, and 3x scale only real-time delta offered to the fixed-step battle accumulator', () => {
  assert.equal(scaleReplayDeltaMs(1000 / 60, 1), 1000 / 60);
  assert.equal(scaleReplayDeltaMs(1000 / 60, 2), 2000 / 60);
  assert.equal(scaleReplayDeltaMs(1000 / 60, 3), 3000 / 60);
  assert.equal(scaleReplayDeltaMs(-1, 3), 0);
  assert.equal(scaleReplayDeltaMs(Number.NaN, 3), 0);
});
