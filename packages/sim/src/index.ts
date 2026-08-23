import { SIM_TICK_RATE } from '@frontline/shared';

export { SIM_TICK_RATE };
export const SIM_TICK_MS = 1000 / SIM_TICK_RATE;

export const UnitState = {
  Moving: 'MOVING',
  Foreswing: 'FORESWING',
  Backswing: 'BACKSWING',
  AttackWait: 'ATTACK_WAIT',
  NaturalKnockback: 'NATURAL_KNOCKBACK',
  ForcedDisplacement: 'FORCED_DISPLACEMENT',
  Dying: 'DYING',
} as const;

export type UnitState = (typeof UnitState)[keyof typeof UnitState];
export type BattleTeam = 'PLAYER' | 'ENEMY';
export type AttackTargetMode = 'SINGLE' | 'AREA';
export type BattleWinner = BattleTeam | 'DRAW' | null;

export interface AttackTiming {
  readonly cycleFrames: number;
  readonly hitFrames: readonly number[];
  readonly backswingFrames: number;
}

export interface BattleUnitDefinition {
  readonly id: string;
  readonly maxHp: number;
  readonly attackDamage: number;
  /** Integer simulation units moved per 30 Hz tick. */
  readonly moveSpeed: number;
  readonly standingRange: number;
  /** Signed range relative to facing direction. Negative values permit rear hits. */
  readonly attackMinRange: number;
  readonly attackMaxRange: number;
  readonly targetMode: AttackTargetMode;
  /** Number of non-lethal natural knockbacks before death. */
  readonly naturalKnockbackCount: number;
  readonly naturalKnockbackFrames: number;
  readonly naturalKnockbackDistance: number;
  readonly deathFrames: number;
  readonly attackTiming: AttackTiming;
}

export interface BattleUnit {
  readonly simulationId: number;
  readonly definition: BattleUnitDefinition;
  readonly team: BattleTeam;
  hp: number;
  anchorX: number;
  state: UnitState;
  stateFrame: number;
  nextAttackTick: number;
  naturalKnockbacksConsumed: number;
  knockbackStartX: number;
  knockbackTargetX: number;
}

export interface BattleBase {
  readonly team: BattleTeam;
  readonly anchorX: number;
  readonly maxHp: number;
  hp: number;
}

export interface BattleConfig {
  readonly mapLength: number;
  readonly playerBaseHp: number;
  readonly enemyBaseHp: number;
}

export interface BattleState {
  tick: number;
  nextSimulationId: number;
  readonly mapLength: number;
  readonly units: BattleUnit[];
  readonly bases: Record<BattleTeam, BattleBase>;
  winner: BattleWinner;
  stateHash: string;
}

type UnitHit = { readonly targetKind: 'UNIT'; readonly targetId: number; readonly damage: number };
type BaseHit = { readonly targetKind: 'BASE'; readonly targetTeam: BattleTeam; readonly damage: number };
type HitEvent = UnitHit | BaseHit;

const oppositeTeam = (team: BattleTeam): BattleTeam => (team === 'PLAYER' ? 'ENEMY' : 'PLAYER');
const directionFor = (team: BattleTeam): 1 | -1 => (team === 'PLAYER' ? 1 : -1);
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

function assertDefinition(definition: BattleUnitDefinition): void {
  const timing = definition.attackTiming;
  if (!Number.isInteger(definition.maxHp) || definition.maxHp <= 0) throw new Error('maxHp must be a positive integer');
  if (!Number.isInteger(definition.attackDamage) || definition.attackDamage < 0) throw new Error('attackDamage must be a non-negative integer');
  if (!Number.isInteger(definition.moveSpeed) || definition.moveSpeed < 0) throw new Error('moveSpeed must be a non-negative integer');
  if (definition.attackMinRange > definition.attackMaxRange) throw new Error('attackMinRange must be <= attackMaxRange');
  if (definition.standingRange < 0) throw new Error('standingRange must be non-negative');
  if (!Number.isInteger(timing.cycleFrames) || timing.cycleFrames <= 0) throw new Error('cycleFrames must be positive');
  if (timing.hitFrames.length === 0) throw new Error('hitFrames must contain at least one frame');
  if (timing.hitFrames.some((frame) => !Number.isInteger(frame) || frame < 0)) throw new Error('hitFrames must be non-negative integers');
  if (timing.hitFrames.some((frame, index) => index > 0 && frame <= timing.hitFrames[index - 1]!)) throw new Error('hitFrames must be strictly increasing');
  if (timing.hitFrames[timing.hitFrames.length - 1]! >= timing.cycleFrames) throw new Error('last hit frame must be inside cycleFrames');
  if (!Number.isInteger(timing.backswingFrames) || timing.backswingFrames < 0) throw new Error('backswingFrames must be non-negative');
  if (!Number.isInteger(definition.naturalKnockbackCount) || definition.naturalKnockbackCount < 0) throw new Error('naturalKnockbackCount must be non-negative');
  if (!Number.isInteger(definition.naturalKnockbackFrames) || definition.naturalKnockbackFrames <= 0) throw new Error('naturalKnockbackFrames must be positive');
  if (!Number.isInteger(definition.deathFrames) || definition.deathFrames <= 0) throw new Error('deathFrames must be positive');
}

export function createBattle(config: BattleConfig): BattleState {
  if (!Number.isInteger(config.mapLength) || config.mapLength <= 0) throw new Error('mapLength must be a positive integer');
  const state: BattleState = {
    tick: 0,
    nextSimulationId: 1,
    mapLength: config.mapLength,
    units: [],
    bases: {
      PLAYER: { team: 'PLAYER', anchorX: 0, maxHp: config.playerBaseHp, hp: config.playerBaseHp },
      ENEMY: { team: 'ENEMY', anchorX: config.mapLength, maxHp: config.enemyBaseHp, hp: config.enemyBaseHp },
    },
    winner: null,
    stateHash: '',
  };
  state.stateHash = computeStateHash(state);
  return state;
}

export function spawnUnit(
  state: BattleState,
  definition: BattleUnitDefinition,
  team: BattleTeam,
  anchorX = team === 'PLAYER' ? state.bases.PLAYER.anchorX : state.bases.ENEMY.anchorX,
): BattleUnit {
  assertDefinition(definition);
  const unit: BattleUnit = {
    simulationId: state.nextSimulationId++,
    definition,
    team,
    hp: definition.maxHp,
    anchorX: clamp(Math.trunc(anchorX), 0, state.mapLength),
    state: UnitState.Moving,
    stateFrame: 0,
    nextAttackTick: 0,
    naturalKnockbacksConsumed: 0,
    knockbackStartX: 0,
    knockbackTargetX: 0,
  };
  state.units.push(unit);
  return unit;
}

function isTargetable(unit: BattleUnit): boolean {
  return unit.state !== UnitState.NaturalKnockback && unit.state !== UnitState.Dying;
}

function signedDistance(source: BattleUnit, targetX: number): number {
  return directionFor(source.team) * (targetX - source.anchorX);
}

function findNearestDetectionDistance(state: BattleState, source: BattleUnit): number | null {
  let nearest: number | null = null;
  for (const target of state.units) {
    if (target.team === source.team || !isTargetable(target)) continue;
    const distance = signedDistance(source, target.anchorX);
    if (distance < 0) continue;
    if (nearest === null || distance < nearest) nearest = distance;
  }
  const baseDistance = signedDistance(source, state.bases[oppositeTeam(source.team)].anchorX);
  if (baseDistance >= 0 && (nearest === null || baseDistance < nearest)) nearest = baseDistance;
  return nearest;
}

function advanceTimers(state: BattleState): void {
  for (const unit of state.units) {
    if (unit.state !== UnitState.Moving) unit.stateFrame += 1;
    if (unit.state === UnitState.NaturalKnockback) {
      const duration = unit.definition.naturalKnockbackFrames;
      const elapsed = Math.min(unit.stateFrame, duration);
      const delta = unit.knockbackTargetX - unit.knockbackStartX;
      unit.anchorX = unit.knockbackStartX + Math.trunc((delta * elapsed) / duration);
      if (elapsed >= duration) {
        unit.anchorX = unit.knockbackTargetX;
        unit.state = UnitState.Moving;
        unit.stateFrame = 0;
      }
    } else if (unit.state === UnitState.AttackWait && state.tick >= unit.nextAttackTick) {
      unit.state = UnitState.Moving;
      unit.stateFrame = 0;
    }
  }
}

function moveUnits(state: BattleState): void {
  for (const unit of state.units) {
    if (unit.state !== UnitState.Moving) continue;
    const nearest = findNearestDetectionDistance(state, unit);
    if (nearest === null || nearest <= unit.definition.standingRange) continue;
    const advance = Math.min(unit.definition.moveSpeed, nearest - unit.definition.standingRange);
    unit.anchorX = clamp(unit.anchorX + directionFor(unit.team) * advance, 0, state.mapLength);
  }
}

function detectAndStartAttacks(state: BattleState): void {
  for (const unit of state.units) {
    if (unit.state !== UnitState.Moving || state.tick < unit.nextAttackTick) continue;
    const nearest = findNearestDetectionDistance(state, unit);
    if (nearest !== null && nearest <= unit.definition.standingRange) {
      unit.state = UnitState.Foreswing;
      unit.stateFrame = 0;
      unit.nextAttackTick = state.tick + unit.definition.attackTiming.cycleFrames;
    }
  }
}

function isInsideAttackRange(source: BattleUnit, targetX: number): boolean {
  const distance = signedDistance(source, targetX);
  return distance >= source.definition.attackMinRange && distance <= source.definition.attackMaxRange;
}

function collectHits(state: BattleState): HitEvent[] {
  const hits: HitEvent[] = [];
  for (const source of state.units) {
    if (source.state !== UnitState.Foreswing) continue;
    if (!source.definition.attackTiming.hitFrames.includes(source.stateFrame)) continue;
    const unitTargets = state.units
      .filter((target) => target.team !== source.team && isTargetable(target) && isInsideAttackRange(source, target.anchorX))
      .sort((a, b) => signedDistance(source, a.anchorX) - signedDistance(source, b.anchorX) || a.simulationId - b.simulationId);
    const base = state.bases[oppositeTeam(source.team)];
    const baseIsInRange = isInsideAttackRange(source, base.anchorX) && base.hp > 0;

    if (source.definition.targetMode === 'AREA') {
      for (const target of unitTargets) hits.push({ targetKind: 'UNIT', targetId: target.simulationId, damage: source.definition.attackDamage });
      if (baseIsInRange) hits.push({ targetKind: 'BASE', targetTeam: base.team, damage: source.definition.attackDamage });
      continue;
    }

    const nearestUnit = unitTargets[0];
    const unitDistance = nearestUnit ? signedDistance(source, nearestUnit.anchorX) : Number.POSITIVE_INFINITY;
    const baseDistance = baseIsInRange ? signedDistance(source, base.anchorX) : Number.POSITIVE_INFINITY;
    if (nearestUnit && unitDistance <= baseDistance) hits.push({ targetKind: 'UNIT', targetId: nearestUnit.simulationId, damage: source.definition.attackDamage });
    else if (baseIsInRange) hits.push({ targetKind: 'BASE', targetTeam: base.team, damage: source.definition.attackDamage });
  }
  return hits;
}

function naturalThreshold(definition: BattleUnitDefinition, index: number): number {
  const count = definition.naturalKnockbackCount;
  return Math.trunc((definition.maxHp * (count + 1 - index)) / (count + 1));
}

function enterNaturalKnockback(state: BattleState, unit: BattleUnit): void {
  const direction = directionFor(unit.team);
  unit.state = UnitState.NaturalKnockback;
  unit.stateFrame = 0;
  unit.knockbackStartX = unit.anchorX;
  unit.knockbackTargetX = clamp(unit.anchorX - direction * unit.definition.naturalKnockbackDistance, 0, state.mapLength);
}

function enterDying(unit: BattleUnit): void {
  unit.hp = 0;
  unit.state = UnitState.Dying;
  unit.stateFrame = 0;
}

function applyHits(state: BattleState, hits: readonly HitEvent[]): void {
  const unitDamage = new Map<number, number>();
  const baseDamage: Record<BattleTeam, number> = { PLAYER: 0, ENEMY: 0 };
  for (const hit of hits) {
    if (hit.targetKind === 'UNIT') unitDamage.set(hit.targetId, (unitDamage.get(hit.targetId) ?? 0) + hit.damage);
    else baseDamage[hit.targetTeam] += hit.damage;
  }

  for (const unit of state.units) {
    const damage = unitDamage.get(unit.simulationId) ?? 0;
    if (damage <= 0 || !isTargetable(unit)) continue;
    const oldHp = unit.hp;
    const newHp = Math.max(0, oldHp - damage);
    unit.hp = newHp;
    if (newHp <= 0) {
      enterDying(unit);
      continue;
    }
    let crossed = 0;
    for (let index = unit.naturalKnockbacksConsumed + 1; index <= unit.definition.naturalKnockbackCount; index += 1) {
      const threshold = naturalThreshold(unit.definition, index);
      if (oldHp > threshold && newHp <= threshold) crossed += 1;
    }
    if (crossed > 0) {
      unit.naturalKnockbacksConsumed = Math.min(unit.definition.naturalKnockbackCount, unit.naturalKnockbacksConsumed + crossed);
      enterNaturalKnockback(state, unit);
    }
  }

  for (const team of ['PLAYER', 'ENEMY'] as const) state.bases[team].hp = Math.max(0, state.bases[team].hp - baseDamage[team]);
}

function advanceAttackStates(state: BattleState): void {
  for (const unit of state.units) {
    if (unit.state === UnitState.Foreswing) {
      const hitFrames = unit.definition.attackTiming.hitFrames;
      if (unit.stateFrame >= hitFrames[hitFrames.length - 1]!) {
        unit.state = UnitState.Backswing;
        unit.stateFrame = 0;
      }
    } else if (unit.state === UnitState.Backswing && unit.stateFrame >= unit.definition.attackTiming.backswingFrames) {
      unit.state = state.tick >= unit.nextAttackTick ? UnitState.Moving : UnitState.AttackWait;
      unit.stateFrame = 0;
    }
  }
}

function removeDeadAndResolveVictory(state: BattleState): void {
  for (let index = state.units.length - 1; index >= 0; index -= 1) {
    const unit = state.units[index]!;
    if (unit.state === UnitState.Dying && unit.stateFrame >= unit.definition.deathFrames) state.units.splice(index, 1);
  }
  const playerDead = state.bases.PLAYER.hp <= 0;
  const enemyDead = state.bases.ENEMY.hp <= 0;
  if (playerDead && enemyDead) state.winner = 'DRAW';
  else if (playerDead) state.winner = 'ENEMY';
  else if (enemyDead) state.winner = 'PLAYER';
}

export function stepBattle(state: BattleState): BattleState {
  if (state.winner !== null) return state;
  state.units.sort((a, b) => a.simulationId - b.simulationId);
  advanceTimers(state);
  moveUnits(state);
  detectAndStartAttacks(state);
  applyHits(state, collectHits(state));
  advanceAttackStates(state);
  removeDeadAndResolveVictory(state);
  state.tick += 1;
  state.stateHash = computeStateHash(state);
  return state;
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function computeStateHash(state: BattleState): string {
  const units = [...state.units]
    .sort((a, b) => a.simulationId - b.simulationId)
    .map((unit) => [unit.simulationId, unit.definition.id, unit.team, unit.hp, unit.anchorX, unit.state, unit.stateFrame, unit.nextAttackTick, unit.naturalKnockbacksConsumed].join(':'))
    .join('|');
  return fnv1a([state.tick, state.nextSimulationId, state.bases.PLAYER.hp, state.bases.ENEMY.hp, state.winner ?? '-', units].join('#'));
}
