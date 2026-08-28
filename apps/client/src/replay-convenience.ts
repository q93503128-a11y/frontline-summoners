import type { PrototypeStage } from './prototype';
import type { GuestProgress } from './save';

export type BattleSpeedMultiplier = 1 | 2;

export interface ReplayConvenienceState {
  readonly speedUpUnlocked: boolean;
  readonly sweepUnlocked: boolean;
}

/**
 * Guest progress is normalized before browser battle/UI consumption. Main clear ids
 * therefore represent actual NORMAL_CLEAR; SPECIAL clear ids are likewise only written
 * by the post-battle result flow in the current implemented slice.
 */
export function hasStageNormalClear(stage: PrototypeStage, progress: GuestProgress): boolean {
  if (stage.stageType === 'SPECIAL') return progress.specialClearedStageIds.includes(stage.id);
  return progress.clearedStageIds.includes(stage.id);
}

export function getReplayConvenienceState(stage: PrototypeStage, progress: GuestProgress): ReplayConvenienceState {
  const hasClear = hasStageNormalClear(stage, progress);
  return {
    speedUpUnlocked: hasClear && stage.speedUpEligibility === 'AFTER_NORMAL_CLEAR',
    sweepUnlocked: hasClear && stage.sweepEligibility === 'AFTER_NORMAL_CLEAR',
  };
}

export function resolveBattleSpeed(
  requestedSpeed: BattleSpeedMultiplier,
  convenience: ReplayConvenienceState,
): BattleSpeedMultiplier {
  return requestedSpeed === 2 && convenience.speedUpUnlocked ? 2 : 1;
}

/**
 * The simulation still advances through the exact same fixed 30 Hz steps in
 * BattleScene. Only the amount of real-time delta offered to its accumulator is
 * scaled, keeping rules/results deterministic while making replay consume time faster.
 */
export function scaleReplayDeltaMs(deltaMs: number, speed: BattleSpeedMultiplier): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return deltaMs * speed;
}
