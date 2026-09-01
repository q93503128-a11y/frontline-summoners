import { UnitState, type BattleUnit } from '@frontline/sim';
import type { SpriteStrip } from './assets.ts';
import { getAttackSpriteFrame, getLoopingSpriteFrame } from './combat-visuals.ts';
import type { RuntimeArtFamily } from './production-assets.ts';

export function selectRuntimeMotionStrip(family: RuntimeArtFamily, unitState: UnitState): SpriteStrip {
  if (unitState === UnitState.NaturalKnockback && family.knockback) return family.knockback;
  if (unitState === UnitState.Dying && family.death) return family.death;
  if (unitState === UnitState.Foreswing || unitState === UnitState.Backswing) return family.attack;
  if (unitState === UnitState.Moving) return family.run;
  return family.idle;
}

function getAuthoredDeathFrame(strip: SpriteStrip, stateFrame: number, deathFrames: number): number {
  if (strip.frames <= 1) return 0;
  const lastStateFrame = Math.max(1, deathFrames - 1);
  const progress = Math.max(0, Math.min(1, stateFrame / lastStateFrame));
  return Math.min(strip.frames - 1, Math.floor(progress * strip.frames));
}

export function getRuntimeMotionFrame(
  family: RuntimeArtFamily,
  strip: SpriteStrip,
  unit: BattleUnit,
  battleTick: number,
): number {
  if (unit.state === UnitState.Foreswing || unit.state === UnitState.Backswing) {
    return getAttackSpriteFrame({
      frameCount: strip.frames,
      contactFrame: family.attackContactFrame,
      timing: unit.definition.attackTiming,
      state: unit.state,
      stateFrame: unit.stateFrame,
    });
  }
  if (unit.state === UnitState.NaturalKnockback && family.knockback === strip) {
    return Math.min(strip.frames - 1, Math.max(0, unit.stateFrame));
  }
  if (unit.state === UnitState.Dying && family.death === strip) {
    return getAuthoredDeathFrame(strip, unit.stateFrame, unit.definition.deathFrames);
  }
  return getLoopingSpriteFrame(strip.frames, battleTick, unit.simulationId);
}

export function usesAuthoredKnockbackMotion(family: RuntimeArtFamily, unitState: UnitState): boolean {
  return unitState === UnitState.NaturalKnockback && family.knockback !== undefined;
}

export function usesAuthoredDeathMotion(family: RuntimeArtFamily, unitState: UnitState): boolean {
  return unitState === UnitState.Dying && family.death !== undefined;
}
