import {
  UnitState,
  getUnitAttackDamageAgainst,
  type AttackPatternStep,
  type BattleState,
  type BattleUnit,
} from './index.ts';
import type { AchievementFactId } from './achievement-profile.ts';

export const TURNIP_RIDER_CHARACTER_ID = 'char_common_c_turnip_rider' as const;
export const CLOCKDUCK_CHARACTER_ID = 'char_common_b_clockduck' as const;
export const BELL_CRAB_CHARACTER_ID = 'char_common_c_bell_crab' as const;
export const TURNIP_FIVE_REQUIRED_COUNT = 5;
export const BELL_CRAB_MULTI_REQUIRED_TARGETS = 3;

export const COMBAT_QUIRK_FACT_IDS = [
  'quirk_turnip_five',
  'quirk_duck_mech_finish',
  'quirk_bellcrab_multi',
] as const satisfies readonly AchievementFactId[];
export type CombatQuirkFactId = (typeof COMBAT_QUIRK_FACT_IDS)[number];

interface ActiveObservedAttack {
  readonly attackMinRange: number;
  readonly attackMaxRange: number;
  readonly hitFrames: readonly number[];
  readonly hitDamages: readonly number[];
}

interface ClockduckFinishCandidate {
  readonly targetSimulationId: number;
  readonly targetHpBefore: number;
  readonly independentDamage: number;
  readonly targetIsMachineBoss: boolean;
}

/**
 * Snapshot only the deterministic information needed to judge the three combat-driven hidden achievements.
 * Call immediately before the authoritative BattleState step, then pass the returned capture to
 * resolveCombatQuirkFacts immediately after that same step.
 */
export interface CombatQuirkFrameCapture {
  readonly tick: number;
  readonly turnipAliveBefore: number;
  readonly bellCrabUnitTargetCounts: readonly number[];
  readonly clockduckFinishCandidates: readonly ClockduckFinishCandidate[];
}

function directionFor(unit: BattleUnit): 1 | -1 {
  return unit.team === 'PLAYER' ? 1 : -1;
}

function signedDistance(source: BattleUnit, targetX: number): number {
  return directionFor(source) * (targetX - source.anchorX);
}

function targetable(unit: BattleUnit): boolean {
  return unit.state !== UnitState.NaturalKnockback
    && unit.state !== UnitState.Reviving
    && unit.state !== UnitState.Dying;
}

function aliveForTurnipChallenge(unit: BattleUnit): boolean {
  return unit.team === 'PLAYER'
    && unit.definition.id === TURNIP_RIDER_CHARACTER_ID
    && unit.hp > 0
    && unit.state !== UnitState.Reviving
    && unit.state !== UnitState.Dying;
}

function reduceHitFrames(hitFrames: readonly number[], reduction: number): readonly number[] {
  if (reduction <= 0) return hitFrames;
  const reduced: number[] = [];
  for (const frame of hitFrames) {
    const minimum = reduced.length === 0 ? 0 : reduced[reduced.length - 1]! + 1;
    reduced.push(Math.max(minimum, frame - reduction));
  }
  return reduced;
}

function observedAttackFromStep(source: BattleUnit, step: AttackPatternStep): ActiveObservedAttack {
  const hitFrames = reduceHitFrames(step.hitFrames, source.activeAttackStartupReductionFrames);
  return {
    attackMinRange: step.attackMinRange,
    attackMaxRange: step.attackMaxRange,
    hitFrames,
    hitDamages: step.hitDamages ?? Array.from({ length: step.hitFrames.length }, () => step.attackDamage),
  };
}

function activeObservedAttack(source: BattleUnit): ActiveObservedAttack {
  if (source.usingCloseRangeAttack && source.definition.closeRangeAttack) {
    return observedAttackFromStep(source, source.definition.closeRangeAttack);
  }
  const patternStep = source.definition.attackPattern?.[source.attackPatternIndex];
  if (patternStep) return observedAttackFromStep(source, patternStep);
  const hitFrames = reduceHitFrames(source.definition.attackTiming.hitFrames, source.activeAttackStartupReductionFrames);
  return {
    attackMinRange: source.definition.attackMinRange,
    attackMaxRange: source.definition.attackMaxRange,
    hitFrames,
    hitDamages: source.definition.hitDamages
      ?? Array.from({ length: source.definition.attackTiming.hitFrames.length }, () => source.definition.attackDamage),
  };
}

function insideAttackRange(source: BattleUnit, targetX: number, attack: ActiveObservedAttack): boolean {
  const distance = signedDistance(source, targetX);
  return distance >= attack.attackMinRange && distance <= attack.attackMaxRange;
}

function unitTargetsForAttack(state: BattleState, source: BattleUnit, attack: ActiveObservedAttack): readonly BattleUnit[] {
  return state.units
    .filter((target) => target.team !== source.team && targetable(target) && insideAttackRange(source, target.anchorX, attack))
    .sort((a, b) => signedDistance(source, a.anchorX) - signedDistance(source, b.anchorX) || a.simulationId - b.simulationId);
}

function outgoingDamage(state: BattleState, source: BattleUnit, damage: number): number {
  const permille = source.weakenUntilTick > state.tick ? source.weakenAttackPermille : 1000;
  return Math.trunc(damage * permille / 1000);
}

function independentDamageAgainst(state: BattleState, source: BattleUnit, target: BattleUnit, authoredDamage: number): number {
  const outgoing = outgoingDamage(state, source, authoredDamage);
  const attributed = getUnitAttackDamageAgainst(source.definition, target.definition, outgoing);
  const incomingPermille = target.damageTakenUntilTick > state.tick ? target.damageTakenPermille : 1000;
  return Math.trunc(attributed * incomingPermille / 1000);
}

function sourceHitIndex(source: BattleUnit, attack: ActiveObservedAttack): number {
  if (source.state !== UnitState.Foreswing) return -1;
  return attack.hitFrames.indexOf(source.stateFrame);
}

function captureBellCrabTargets(state: BattleState, source: BattleUnit): number | null {
  const attack = activeObservedAttack(source);
  if (sourceHitIndex(source, attack) < 0) return null;
  return unitTargetsForAttack(state, source, attack).length;
}

function captureClockduckCandidate(state: BattleState, source: BattleUnit): ClockduckFinishCandidate | null {
  const attack = activeObservedAttack(source);
  const hitIndex = sourceHitIndex(source, attack);
  if (hitIndex < 0) return null;
  const unitTargets = unitTargetsForAttack(state, source, attack);
  const nearestUnit = unitTargets[0];
  if (!nearestUnit) return null;

  const enemyBase = state.bases.ENEMY;
  const baseIsInRange = insideAttackRange(source, enemyBase.anchorX, attack) && enemyBase.hp > 0;
  const unitDistance = signedDistance(source, nearestUnit.anchorX);
  const baseDistance = baseIsInRange ? signedDistance(source, enemyBase.anchorX) : Number.POSITIVE_INFINITY;
  if (unitDistance > baseDistance) return null;

  const authoredDamage = attack.hitDamages[hitIndex] ?? 0;
  const attributes = new Set(nearestUnit.definition.attributes ?? []);
  const tags = new Set(nearestUnit.definition.combatTags ?? []);
  return {
    targetSimulationId: nearestUnit.simulationId,
    targetHpBefore: nearestUnit.hp,
    independentDamage: independentDamageAgainst(state, source, nearestUnit, authoredDamage),
    targetIsMachineBoss: attributes.has('MACHINE') && tags.has('BOSS'),
  };
}

export function captureCombatQuirkFrame(state: BattleState): CombatQuirkFrameCapture {
  const bellCrabUnitTargetCounts: number[] = [];
  const clockduckFinishCandidates: ClockduckFinishCandidate[] = [];
  const sources = [...state.units].sort((a, b) => a.simulationId - b.simulationId);

  for (const source of sources) {
    if (source.team !== 'PLAYER' || source.hp <= 0) continue;
    if (source.definition.id === BELL_CRAB_CHARACTER_ID) {
      const targetCount = captureBellCrabTargets(state, source);
      if (targetCount !== null) bellCrabUnitTargetCounts.push(targetCount);
    } else if (source.definition.id === CLOCKDUCK_CHARACTER_ID) {
      const candidate = captureClockduckCandidate(state, source);
      if (candidate) clockduckFinishCandidates.push(candidate);
    }
  }

  return {
    tick: state.tick,
    turnipAliveBefore: state.units.filter(aliveForTurnipChallenge).length,
    bellCrabUnitTargetCounts,
    clockduckFinishCandidates,
  };
}

export function resolveCombatQuirkFacts(
  capture: CombatQuirkFrameCapture,
  stateAfterStep: BattleState,
): readonly CombatQuirkFactId[] {
  const facts = new Set<CombatQuirkFactId>();
  const turnipAliveAfter = stateAfterStep.units.filter(aliveForTurnipChallenge).length;
  if (Math.max(capture.turnipAliveBefore, turnipAliveAfter) >= TURNIP_FIVE_REQUIRED_COUNT) {
    facts.add('quirk_turnip_five');
  }
  if (capture.bellCrabUnitTargetCounts.some((count) => count >= BELL_CRAB_MULTI_REQUIRED_TARGETS)) {
    facts.add('quirk_bellcrab_multi');
  }

  for (const candidate of capture.clockduckFinishCandidates) {
    if (!candidate.targetIsMachineBoss || candidate.independentDamage < candidate.targetHpBefore) continue;
    const targetAfter = stateAfterStep.units.find((unit) => unit.simulationId === candidate.targetSimulationId);
    if (!targetAfter || targetAfter.state === UnitState.Dying) {
      facts.add('quirk_duck_mech_finish');
      break;
    }
  }
  return [...facts];
}
