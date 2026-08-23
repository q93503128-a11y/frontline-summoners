import { UnitState, type AttackTiming, type UnitState as BattleUnitState } from '@frontline/sim';

export interface AttackFrameMappingInput {
  readonly frameCount: number;
  readonly contactFrame: number;
  readonly timing: AttackTiming;
  readonly state: BattleUnitState;
  readonly stateFrame: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/**
 * Maps the deterministic simulation attack clock onto a sprite strip.
 *
 * The first actual simulation hit always lands on contactFrame. Recovery then
 * advances from the contact pose to the final sprite frame. This keeps damage
 * and the visible impact pose synchronized even when unit timings differ.
 */
export function getAttackSpriteFrame(input: AttackFrameMappingInput): number {
  const { frameCount, timing, state } = input;
  if (!Number.isInteger(frameCount) || frameCount <= 0) throw new Error('frameCount must be a positive integer');
  if (!Number.isInteger(input.contactFrame)) throw new Error('contactFrame must be an integer');
  if (!Number.isInteger(input.stateFrame) || input.stateFrame < 0) throw new Error('stateFrame must be a non-negative integer');

  const finalFrame = frameCount - 1;
  const contactFrame = clamp(input.contactFrame, 0, finalFrame);
  const firstHit = timing.hitFrames[0] ?? 0;
  const lastHit = timing.hitFrames[timing.hitFrames.length - 1] ?? firstHit;
  const elapsed = state === UnitState.Backswing ? lastHit + input.stateFrame : input.stateFrame;

  if (elapsed <= firstHit) {
    if (firstHit <= 0) return contactFrame;
    return clamp(Math.round((elapsed / firstHit) * contactFrame), 0, contactFrame);
  }

  const attackEnd = Math.max(firstHit + 1, lastHit + timing.backswingFrames);
  const recoverySpan = Math.max(1, attackEnd - firstHit);
  const recoveryProgress = clamp((elapsed - firstHit) / recoverySpan, 0, 1);
  return clamp(contactFrame + Math.floor(recoveryProgress * (finalFrame - contactFrame)), contactFrame, finalFrame);
}

export function getLoopingSpriteFrame(frameCount: number, tick: number, simulationId: number, ticksPerFrame = 4): number {
  if (!Number.isInteger(frameCount) || frameCount <= 0) throw new Error('frameCount must be a positive integer');
  if (!Number.isInteger(ticksPerFrame) || ticksPerFrame <= 0) throw new Error('ticksPerFrame must be a positive integer');
  const phase = Math.max(0, Math.trunc(tick)) + Math.max(0, Math.trunc(simulationId)) * 3;
  return Math.floor(phase / ticksPerFrame) % frameCount;
}

export type ImpactWeight = 'LIGHT' | 'MEDIUM' | 'HEAVY';

export function classifyImpact(damage: number, maxHp: number): ImpactWeight {
  if (maxHp <= 0) return 'LIGHT';
  const ratio = Math.max(0, damage) / maxHp;
  if (ratio >= 0.34) return 'HEAVY';
  if (ratio >= 0.14) return 'MEDIUM';
  return 'LIGHT';
}
