import type { AttackFxStyle } from './assets.ts';

export interface ProjectileVisualProfile {
  readonly leadTicks: number;
  readonly arcHeightPx: number;
  readonly minimumTravelMs: number;
  readonly maximumTravelMs: number;
}

const PROFILES: Readonly<Partial<Record<AttackFxStyle, ProjectileVisualProfile>>> = {
  PIERCE: { leadTicks: 2, arcHeightPx: 0, minimumTravelMs: 70, maximumTravelMs: 120 },
  MAGIC: { leadTicks: 4, arcHeightPx: 12, minimumTravelMs: 105, maximumTravelMs: 175 },
  FIRE: { leadTicks: 5, arcHeightPx: 22, minimumTravelMs: 125, maximumTravelMs: 210 },
  VOID: { leadTicks: 6, arcHeightPx: 30, minimumTravelMs: 145, maximumTravelMs: 240 },
};

export function getProjectileVisualProfile(style: AttackFxStyle): ProjectileVisualProfile | null {
  return PROFILES[style] ?? null;
}

export function getProjectileLaunchFrame(style: AttackFxStyle, firstHitFrame: number): number | null {
  const profile = getProjectileVisualProfile(style);
  if (!profile) return null;
  return Math.max(0, firstHitFrame - profile.leadTicks);
}

export function getProjectileTravelDurationMs(style: AttackFxStyle, screenDistancePx: number): number {
  const profile = getProjectileVisualProfile(style);
  if (!profile) return 0;
  const distance = Math.max(0, screenDistancePx);
  const normalized = Math.min(1, distance / 360);
  return Math.round(profile.minimumTravelMs + (profile.maximumTravelMs - profile.minimumTravelMs) * normalized);
}

/** Cosmetic quadratic arc only; battle collision remains one-dimensional and deterministic. */
export function getProjectileArcOffsetY(style: AttackFxStyle, progress: number): number {
  const profile = getProjectileVisualProfile(style);
  if (!profile) return 0;
  const t = Math.max(0, Math.min(1, progress));
  return -4 * profile.arcHeightPx * t * (1 - t);
}

export function usesTravelProjectile(style: AttackFxStyle): boolean {
  return getProjectileVisualProfile(style) !== null;
}
