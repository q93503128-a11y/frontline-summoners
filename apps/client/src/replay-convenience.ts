import type { PrototypeStage } from './prototype';
import type { GuestProgress } from './save';

export type BattleSpeedMultiplier = 1 | 2 | 3;
export type MaxBattleSpeedMultiplier = 2 | 3;

export interface ReplayConvenienceState {
  /** 2× is a baseline battle convenience; this is the highest tier currently available. */
  readonly maxBattleSpeed: MaxBattleSpeedMultiplier;
  /** Existing per-stage speedUpEligibility now governs the extra 3× tier after NORMAL_CLEAR. */
  readonly tripleSpeedUnlocked: boolean;
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
  const tripleSpeedUnlocked = hasClear && stage.speedUpEligibility === 'AFTER_NORMAL_CLEAR';
  return {
    maxBattleSpeed: tripleSpeedUnlocked ? 3 : 2,
    tripleSpeedUnlocked,
    sweepUnlocked: hasClear && stage.sweepEligibility === 'AFTER_NORMAL_CLEAR',
  };
}

export function resolveBattleSpeed(
  requestedSpeed: BattleSpeedMultiplier,
  convenience: ReplayConvenienceState,
): BattleSpeedMultiplier {
  return requestedSpeed <= convenience.maxBattleSpeed ? requestedSpeed : convenience.maxBattleSpeed;
}

export function getNextBattleSpeed(
  currentSpeed: BattleSpeedMultiplier,
  convenience: ReplayConvenienceState,
): BattleSpeedMultiplier {
  const current = resolveBattleSpeed(currentSpeed, convenience);
  if (current >= convenience.maxBattleSpeed) return 1;
  return current === 1 ? 2 : 3;
}

/**
 * The simulation still advances through the exact same fixed 30 Hz steps in
 * BattleScene. Only the amount of real-time delta offered to its accumulator is
 * scaled, keeping rules/results deterministic while making direct play consume time faster.
 */
export function scaleReplayDeltaMs(deltaMs: number, speed: BattleSpeedMultiplier): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return deltaMs * speed;
}
