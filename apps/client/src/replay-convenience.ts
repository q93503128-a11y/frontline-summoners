import type { PrototypeStage } from './prototype';
import { hasNormalClear, type GuestProgress } from './save';

export type BattleSpeedMultiplier = 1 | 2;

export interface ReplayConvenienceState {
  readonly speedUpUnlocked: boolean;
  readonly sweepUnlocked: boolean;
}

/**
 * NORMAL_CLEAR is always an actual battle clear. Main stages keep the authoritative
 * source map in save.ts; implemented SPECIAL clears are also only recorded by the
 * post-battle result scene, so their cleared id is an actual-battle clear as well.
 */
export function hasStageNormalClear(stage: PrototypeStage, progress: GuestProgress): boolean {
  if (stage.stageType === 'SPECIAL') return progress.specialClearedStageIds.includes(stage.id);
  return hasNormalClear(progress, stage.id);
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
