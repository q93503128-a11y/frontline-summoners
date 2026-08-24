import type { AttackFxStyle } from './assets.ts';

export interface ProjectileVisualProfile {
  readonly arcHeightPx: number;
  readonly minimumTravelMs: number;
  readonly maximumTravelMs: number;
}

export interface ProjectileTravelPlan {
  readonly launchFrame: number;
  readonly travelTicks: number;
  readonly durationMs: number;
}

/** Visual timing follows the same 30 Hz cadence as the deterministic battle simulation. */
export const PROJECTILE_VISUAL_TICK_MS = 1000 / 30;

const PROFILES: Readonly<Partial<Record<AttackFxStyle, ProjectileVisualProfile>>> = {
  PIERCE: { arcHeightPx: 0, minimumTravelMs: 70, maximumTravelMs: 120 },
  MAGIC: { arcHeightPx: 12, minimumTravelMs: 105, maximumTravelMs: 175 },
  FIRE: { arcHeightPx: 22, minimumTravelMs: 125, maximumTravelMs: 210 },
  VOID: { arcHeightPx: 30, minimumTravelMs: 145, maximumTravelMs: 240 },
};

export function getProjectileVisualProfile(style: AttackFxStyle): ProjectileVisualProfile | null {
  return PROFILES[style] ?? null;
}

/** Desired cosmetic duration before snapping it to whole simulation ticks. */
export function getProjectileTravelDurationMs(style: AttackFxStyle, screenDistancePx: number): number {
  const profile = getProjectileVisualProfile(style);
  if (!profile) return 0;
  const distance = Math.max(0, screenDistancePx);
  const normalized = Math.min(1, distance / 360);
  return Math.round(profile.minimumTravelMs + (profile.maximumTravelMs - profile.minimumTravelMs) * normalized);
}

/**
 * Converts distance-based cosmetic travel time to whole simulation ticks.
 * Launch is moved earlier by exactly that many ticks so the visual reaches its destination on hitFrame.
 */
export function getProjectileTravelPlan(
  style: AttackFxStyle,
  firstHitFrame: number,
  screenDistancePx: number,
): ProjectileTravelPlan | null {
  const profile = getProjectileVisualProfile(style);
  if (!profile) return null;
  const safeHitFrame = Math.max(0, Math.trunc(firstHitFrame));
  const desiredDuration = getProjectileTravelDurationMs(style, screenDistancePx);
  const desiredTicks = Math.max(1, Math.ceil(desiredDuration / PROJECTILE_VISUAL_TICK_MS));
  const travelTicks = Math.min(safeHitFrame, desiredTicks);
  return {
    launchFrame: safeHitFrame - travelTicks,
    travelTicks,
    durationMs: travelTicks * PROJECTILE_VISUAL_TICK_MS,
  };
}

export function getProjectileLaunchFrame(
  style: AttackFxStyle,
  firstHitFrame: number,
  screenDistancePx = 180,
): number | null {
  return getProjectileTravelPlan(style, firstHitFrame, screenDistancePx)?.launchFrame ?? null;
}

/** Cosmetic quadratic arc only; battle collision remains one-dimensional and deterministic. */
export function getProjectileArcOffsetY(style: AttackFxStyle, progress: number): number {
  const profile = getProjectileVisualProfile(style);
  if (!profile) return 0;
  const t = Math.max(0, Math.min(1, progress));
  if (profile.arcHeightPx === 0 || t === 0 || t === 1) return 0;
  return -4 * profile.arcHeightPx * t * (1 - t);
}

export function usesTravelProjectile(style: AttackFxStyle): boolean {
  return getProjectileVisualProfile(style) !== null;
}
