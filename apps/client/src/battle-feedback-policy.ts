import {
  getClientSettings,
  getScreenShakeFactor,
  shouldReduceDecorativeEffects,
  shouldUseReducedMotion,
  shouldUseStrongFlash,
  type ClientSettingsV1,
} from './client-settings.ts';

export interface BattleFeedbackPolicy {
  readonly screenShakeFactor: number;
  readonly reducedMotion: boolean;
  readonly reducedDecorativeEffects: boolean;
  readonly strongFlash: boolean;
}

/**
 * Presentation-only battle feedback policy.
 * This module must never alter simulation time, commands, hit geometry, damage,
 * target selection, boss discovery, or any other authoritative battle state.
 */
export function getBattleFeedbackPolicy(settings: ClientSettingsV1 = getClientSettings()): BattleFeedbackPolicy {
  return {
    screenShakeFactor: getScreenShakeFactor(settings),
    reducedMotion: shouldUseReducedMotion(settings),
    reducedDecorativeEffects: shouldReduceDecorativeEffects(settings),
    strongFlash: shouldUseStrongFlash(settings),
  };
}

export function scaleBattleShakeIntensity(intensity: number, settings: ClientSettingsV1 = getClientSettings()): number {
  if (!Number.isFinite(intensity) || intensity <= 0) return 0;
  return intensity * getScreenShakeFactor(settings);
}

export function resolveBattleFeedbackDuration(
  authoredDurationMs: number,
  settings: ClientSettingsV1 = getClientSettings(),
): number {
  if (!Number.isFinite(authoredDurationMs) || authoredDurationMs <= 0) return 0;
  return shouldUseReducedMotion(settings) ? 0 : Math.round(authoredDurationMs);
}
