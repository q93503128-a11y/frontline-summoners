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
  Reviving: 'REVIVING',
  Dying: 'DYING',
} as const;

export type UnitState = (typeof UnitState)[keyof typeof UnitState];
export type BattleTeam = 'PLAYER' | 'ENEMY';
export type AttackTargetMode = 'SINGLE' | 'AREA';
export type BattleWinner = BattleTeam | 'DRAW' | null;

export const CombatAttribute = {
  Neutral: 'NEUTRAL',
  Beast: 'BEAST',
  Undead: 'UNDEAD',
  Nature: 'NATURE',
  Arcane: 'ARCANE',
  Demon: 'DEMON',
  Machine: 'MACHINE',
  Anomaly: 'ANOMALY',
} as const;
export type CombatAttribute = (typeof CombatAttribute)[keyof typeof CombatAttribute];
const COMBAT_ATTRIBUTE_VALUES = new Set<CombatAttribute>(Object.values(CombatAttribute));

export const CombatTag = {
  Armored: 'ARMORED',
  Floating: 'FLOATING',
  Giant: 'GIANT',
  Boss: 'BOSS',
  Structure: 'STRUCTURE',
  Summon: 'SUMMON',
  Swarm: 'SWARM',
} as const;
export type CombatTag = (typeof CombatTag)[keyof typeof CombatTag];
const COMBAT_TAG_VALUES = new Set<CombatTag>(Object.values(CombatTag));

export type DamageBonus =
  | { readonly targetKind: 'ATTRIBUTE'; readonly target: CombatAttribute; readonly multiplierPermille: number }
  | { readonly targetKind: 'TAG'; readonly target: CombatTag; readonly multiplierPermille: number };

export interface OnHitSlowDefinition {
  readonly chancePermille: number;
  readonly durationFrames: number;
  /** Movement speed while slowed. 600 means 60% of normal speed. */
  readonly speedPermille: number;
}

export interface OnHitPushDefinition {
  readonly chancePermille: number;
  readonly distance: number;
  readonly frames: number;
}

export interface ReviveOnceDefinition {
  readonly delayFrames: number;
  readonly hpPermille: number;
}

export interface AttackTiming {
  readonly cycleFrames: number;
  readonly hitFrames: readonly number[];
  readonly backswingFrames: number;
}

export interface AttackPatternStep {
  readonly attackDamage: number;
  readonly attackMinRange: number;
  readonly attackMaxRange: number;
  readonly cycleFrames: number;
  readonly hitFrames: readonly number[];
  readonly onHitSlow?: OnHitSlowDefinition;
  readonly onHitPush?: OnHitPushDefinition;
}

export interface CloseRangeAttackDefinition extends AttackPatternStep {
  readonly triggerMaxDistance: number;
}

export interface BattleUnitDefinition {
  readonly id: string;
  readonly maxHp: number;
  readonly attackDamage: number;
  readonly moveSpeed: number;
  readonly standingRange: number;
  readonly attackMinRange: number;
  readonly attackMaxRange: number;
  readonly targetMode: AttackTargetMode;
  readonly naturalKnockbackCount: number;
  readonly naturalKnockbackFrames: number;
  readonly naturalKnockbackDistance: number;
  readonly deathFrames: number;
  readonly attackTiming: AttackTiming;
  /** Optional deterministic attack sequence. Missing means the legacy single attack profile. */
  readonly attackPattern?: readonly AttackPatternStep[];
  /** Optional conditional replacement attack selected when the nearest target is close enough at attack start. */
  readonly closeRangeAttack?: CloseRangeAttackDefinition;
  readonly onHitSlow?: OnHitSlowDefinition;
  readonly onHitPush?: OnHitPushDefinition;
  readonly reviveOnce?: ReviveOnceDefinition;
  /** One or two identity attributes. NEUTRAL is used alone. There is no global RPS table. */
  readonly attributes?: readonly CombatAttribute[];
  /** Supplemental combat taxonomy such as ARMORED/GIANT/BOSS. */
  readonly combatTags?: readonly CombatTag[];
  /** Optional specialist damage. Only the strongest matching bonus is applied. */
  readonly damageBonuses?: readonly DamageBonus[];
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
  attackPatternIndex: number;
  usingCloseRangeAttack: boolean;
  naturalKnockbacksConsumed: number;
  knockbackStartX: number;
  knockbackTargetX: number;
  forcedDisplacementFrames: number;
  slowUntilTick: number;
  slowSpeedPermille: number;
  reviveUsed: boolean;
  reviveReadyTick: number;
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

type UnitHit = {
  readonly targetKind: 'UNIT';
  readonly sourceId: number;
  readonly targetId: number;
  readonly damage: number;
  readonly onHitSlow?: OnHitSlowDefinition;
  readonly onHitPush?: OnHitPushDefinition;
};
type BaseHit = { readonly targetKind: 'BASE'; readonly targetTeam: BattleTeam; readonly damage: number };
type HitEvent = UnitHit | BaseHit;

type ActiveAttackProfile = {
  readonly attackDamage: number;
  readonly attackMinRange: number;
  readonly attackMaxRange: number;
  readonly cycleFrames: number;
  readonly hitFrames: readonly number[];
  readonly backswingFrames: number;
  readonly onHitSlow?: OnHitSlowDefinition;
  readonly onHitPush?: OnHitPushDefinition;
};

const oppositeTeam = (team: BattleTeam): BattleTeam => (team === 'PLAYER' ? 'ENEMY' : 'PLAYER');
const directionFor = (team: BattleTeam): 1 | -1 => (team === 'PLAYER' ? 1 : -1);
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const quantizePosition = (value: number): number => Math.round(value * 1000) / 1000;

function assertAttackFrames(cycleFrames: number, hitFrames: readonly number[], context: string): void {
  if (!Number.isInteger(cycleFrames) || cycleFrames <= 0) throw new Error(`${context}.cycleFrames must be positive`);
  if (hitFrames.length === 0) throw new Error(`${context}.hitFrames must contain at least one frame`);
  if (hitFrames.some((frame) => !Number.isInteger(frame) || frame < 0)) throw new Error(`${context}.hitFrames must be non-negative integers`);
  if (hitFrames.some((frame, index) => index > 0 && frame <= hitFrames[index - 1]!)) throw new Error(`${context}.hitFrames must be strictly increasing`);
  if (hitFrames[hitFrames.length - 1]! >= cycleFrames) throw new Error(`${context}.last hit frame must be inside cycleFrames`);
}

function assertProbabilityPermille(value: number, context: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 1000) throw new Error(`${context}.chancePermille must be an integer in 1..1000`);
}

function assertSlow(effect: OnHitSlowDefinition | undefined, context: string): void {
  if (!effect) return;
  assertProbabilityPermille(effect.chancePermille, context);
  if (!Number.isInteger(effect.durationFrames) || effect.durationFrames <= 0) throw new Error(`${context}.durationFrames must be positive`);
  if (!Number.isInteger(effect.speedPermille) || effect.speedPermille < 1 || effect.speedPermille >= 1000) throw new Error(`${context}.speedPermille must be an integer in 1..999`);
}

function assertPush(effect: OnHitPushDefinition | undefined, context: string): void {
  if (!effect) return;
  assertProbabilityPermille(effect.chancePermille, context);
  if (!Number.isInteger(effect.distance) || effect.distance < 0) throw new Error(`${context}.distance must be a non-negative integer`);
  if (!Number.isInteger(effect.frames) || effect.frames <= 0) throw new Error(`${context}.frames must be positive`);
}

function assertAttackProfile(profile: AttackPatternStep, context: string): void {
  if (!Number.isInteger(profile.attackDamage) || profile.attackDamage < 0) throw new Error(`${context}.attackDamage must be a non-negative integer`);
  if (!Number.isInteger(profile.attackMinRange) || profile.attackMinRange < 0) throw new Error(`${context}.attackMinRange must be a non-negative integer`);
  if (!Number.isInteger(profile.attackMaxRange) || profile.attackMaxRange < 0) throw new Error(`${context}.attackMaxRange must be a non-negative integer`);
  if (profile.attackMinRange > profile.attackMaxRange) throw new Error(`${context}.attackMinRange must be <= attackMaxRange`);
  assertAttackFrames(profile.cycleFrames, profile.hitFrames, context);
  assertSlow(profile.onHitSlow, `${context}.onHitSlow`);
  assertPush(profile.onHitPush, `${context}.onHitPush`);
}

function assertDefinition(definition: BattleUnitDefinition): void {
  const timing = definition.attackTiming;
  if (!Number.isInteger(definition.maxHp) || definition.maxHp <= 0) throw new Error('maxHp must be a positive integer');
  if (!Number.isInteger(definition.attackDamage) || definition.attackDamage < 0) throw new Error('attackDamage must be a non-negative integer');
  if (!Number.isFinite(definition.moveSpeed) || definition.moveSpeed < 0 || definition.moveSpeed > 1000) throw new Error('moveSpeed must be a finite non-negative number');
  if (!Number.isInteger(definition.attackMinRange) || !Number.isInteger(definition.attackMaxRange) || definition.attackMinRange < 0 || definition.attackMaxRange < 0) throw new Error('attack range must use non-negative integers');
  if (definition.attackMinRange > definition.attackMaxRange) throw new Error('attackMinRange must be <= attackMaxRange');
  if (!Number.isInteger(definition.standingRange) || definition.standingRange < 0) throw new Error('standingRange must be non-negative');
  assertAttackFrames(timing.cycleFrames, timing.hitFrames, 'attackTiming');
  if (!Number.isInteger(timing.backswingFrames) || timing.backswingFrames < 0) throw new Error('backswingFrames must be non-negative');
  assertSlow(definition.onHitSlow, 'onHitSlow');
  assertPush(definition.onHitPush, 'onHitPush');
  if (definition.attackPattern !== undefined) {
    if (definition.attackPattern.length === 0) throw new Error('attackPattern must contain at least one step');
    definition.attackPattern.forEach((step, index) => assertAttackProfile(step, `attackPattern[${index}]`));
  }
  if (definition.closeRangeAttack) {
    assertAttackProfile(definition.closeRangeAttack, 'closeRangeAttack');
    if (!Number.isInteger(definition.closeRangeAttack.triggerMaxDistance) || definition.closeRangeAttack.triggerMaxDistance < 0) throw new Error('closeRangeAttack.triggerMaxDistance must be a non-negative integer');
  }
  if (definition.reviveOnce) {
    if (!Number.isInteger(definition.reviveOnce.delayFrames) || definition.reviveOnce.delayFrames <= 0) throw new Error('reviveOnce.delayFrames must be positive');
    if (!Number.isInteger(definition.reviveOnce.hpPermille) || definition.reviveOnce.hpPermille < 1 || definition.reviveOnce.hpPermille > 1000) throw new Error('reviveOnce.hpPermille must be in 1..1000');
  }
  if (!Number.isInteger(definition.naturalKnockbackCount) || definition.naturalKnockbackCount < 0) throw new Error('naturalKnockbackCount must be non-negative');
  if (!Number.isInteger(definition.naturalKnockbackFrames) || definition.naturalKnockbackFrames <= 0) throw new Error('naturalKnockbackFrames must be positive');
  if (!Number.isInteger(definition.naturalKnockbackDistance) || definition.naturalKnockbackDistance < 0) throw new Error('naturalKnockbackDistance must be a non-negative integer');
  if (!Number.isInteger(definition.deathFrames) || definition.deathFrames <= 0) throw new Error('deathFrames must be positive');

  const attributes = definition.attributes ?? [];
  if (attributes.length === 0 || attributes.length > 2) throw new Error('attributes must contain one or two values');
  if (new Set(attributes).size !== attributes.length) throw new Error('attributes must be unique');
  if (attributes.some((attribute) => !COMBAT_ATTRIBUTE_VALUES.has(attribute))) throw new Error('unknown combat attribute');
  if (attributes.includes('NEUTRAL') && attributes.length !== 1) throw new Error('NEUTRAL cannot be combined with another attribute');

  const tags = definition.combatTags ?? [];
  if (new Set(tags).size !== tags.length) throw new Error('combatTags must be unique');
  if (tags.some((tag) => !COMBAT_TAG_VALUES.has(tag))) throw new Error('unknown combat tag');

  const bonuses = definition.damageBonuses ?? [];
  const bonusKeys = bonuses.map((bonus) => `${bonus.targetKind}:${bonus.target}`);
  if (new Set(bonusKeys).size !== bonuses.length) throw new Error('damage bonus targets must be unique');
  for (const bonus of bonuses) {
    if (bonus.targetKind === 'ATTRIBUTE') {
      if (!COMBAT_ATTRIBUTE_VALUES.has(bonus.target)) throw new Error('unknown damage bonus attribute');
    } else if (!COMBAT_TAG_VALUES.has(bonus.target)) {
      throw new Error('unknown damage bonus tag');
    }
    if (!Number.isInteger(bonus.multiplierPermille) || bonus.multiplierPermille < 1000 || bonus.multiplierPermille > 3000) {
      throw new Error('damage bonus multiplierPermille must be an integer from 1000 to 3000');
    }
  }
}

/** No implicit attribute matchup exists. Only explicit specialist bonuses apply. */
export function getUnitAttackDamageAgainst(source: BattleUnitDefinition, target: BattleUnitDefinition, attackDamage = source.attackDamage): number {
  const targetAttributes = new Set(target.attributes ?? []);
  const targetTags = new Set(target.combatTags ?? []);
  let multiplierPermille = 1000;
  for (const bonus of source.damageBonuses ?? []) {
    const matches = bonus.targetKind === 'ATTRIBUTE'
      ? targetAttributes.has(bonus.target)
      : targetTags.has(bonus.target);
    if (matches) multiplierPermille = Math.max(multiplierPermille, bonus.multiplierPermille);
  }
  return Math.trunc((attackDamage * multiplierPermille) / 1000);
}

export function createBattle(config: BattleConfig): BattleState {
  if (!Number.isInteger(config.mapLength) || config.mapLength <= 0) throw new Error('mapLength must be a positive integer');
  if (!Number.isInteger(config.playerBaseHp) || config.playerBaseHp <= 0) throw new Error('playerBaseHp must be a positive integer');
  if (!Number.isInteger(config.enemyBaseHp) || config.enemyBaseHp <= 0) throw new Error('enemyBaseHp must be a positive integer');
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

export function spawnUnit(state: BattleState, definition: BattleUnitDefinition, team: BattleTeam, anchorX = team === 'PLAYER' ? state.bases.PLAYER.anchorX : state.bases.ENEMY.anchorX): BattleUnit {
  assertDefinition(definition);
  const unit: BattleUnit = {
    simulationId: state.nextSimulationId++, definition, team, hp: definition.maxHp,
    anchorX: clamp(Math.trunc(anchorX), 0, state.mapLength), state: UnitState.Moving, stateFrame: 0,
    nextAttackTick: 0, attackPatternIndex: 0, usingCloseRangeAttack: false,
    naturalKnockbacksConsumed: 0, knockbackStartX: 0, knockbackTargetX: 0,
    forcedDisplacementFrames: 0, slowUntilTick: 0, slowSpeedPermille: 1000,
    reviveUsed: false, reviveReadyTick: 0,
  };
  state.units.push(unit);
  return unit;
}

function isTargetable(unit: BattleUnit): boolean {
  return unit.state !== UnitState.NaturalKnockback && unit.state !== UnitState.Reviving && unit.state !== UnitState.Dying;
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

function advanceDisplacement(unit: BattleUnit, duration: number): void {
  const elapsed = Math.min(unit.stateFrame, duration);
  unit.anchorX = unit.knockbackStartX + Math.trunc(((unit.knockbackTargetX - unit.knockbackStartX) * elapsed) / duration);
  if (elapsed >= duration) {
    unit.anchorX = unit.knockbackTargetX;
    unit.state = UnitState.Moving;
    unit.stateFrame = 0;
    unit.forcedDisplacementFrames = 0;
  }
}

function advanceTimers(state: BattleState): void {
  for (const unit of state.units) {
    if (unit.state !== UnitState.Moving) unit.stateFrame += 1;
    if (unit.slowUntilTick <= state.tick) unit.slowSpeedPermille = 1000;
    if (unit.state === UnitState.Reviving && state.tick >= unit.reviveReadyTick) {
      const revive = unit.definition.reviveOnce;
      if (!revive) throw new Error('reviving unit is missing reviveOnce definition');
      unit.hp = Math.max(1, Math.round(unit.definition.maxHp * revive.hpPermille / 1000));
      unit.state = UnitState.Moving;
      unit.stateFrame = 0;
      unit.reviveReadyTick = 0;
      continue;
    }
    if (unit.state === UnitState.NaturalKnockback) {
      advanceDisplacement(unit, unit.definition.naturalKnockbackFrames);
    } else if (unit.state === UnitState.ForcedDisplacement) {
      advanceDisplacement(unit, Math.max(1, unit.forcedDisplacementFrames));
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
    const slowPermille = unit.slowUntilTick > state.tick ? unit.slowSpeedPermille : 1000;
    const moveSpeed = unit.definition.moveSpeed * slowPermille / 1000;
    const advance = Math.min(moveSpeed, nearest - unit.definition.standingRange);
    unit.anchorX = quantizePosition(clamp(unit.anchorX + directionFor(unit.team) * advance, 0, state.mapLength));
  }
}

function profileFromStep(step: AttackPatternStep, backswingFrames: number): ActiveAttackProfile {
  return {
    attackDamage: step.attackDamage,
    attackMinRange: step.attackMinRange,
    attackMaxRange: step.attackMaxRange,
    cycleFrames: step.cycleFrames,
    hitFrames: step.hitFrames,
    backswingFrames,
    ...(step.onHitSlow === undefined ? {} : { onHitSlow: step.onHitSlow }),
    ...(step.onHitPush === undefined ? {} : { onHitPush: step.onHitPush }),
  };
}

function getActiveAttackProfile(unit: BattleUnit): ActiveAttackProfile {
  if (unit.usingCloseRangeAttack && unit.definition.closeRangeAttack) {
    return profileFromStep(unit.definition.closeRangeAttack, unit.definition.attackTiming.backswingFrames);
  }
  const step = unit.definition.attackPattern?.[unit.attackPatternIndex];
  if (step) return profileFromStep(step, unit.definition.attackTiming.backswingFrames);
  return {
    attackDamage: unit.definition.attackDamage,
    attackMinRange: unit.definition.attackMinRange,
    attackMaxRange: unit.definition.attackMaxRange,
    cycleFrames: unit.definition.attackTiming.cycleFrames,
    hitFrames: unit.definition.attackTiming.hitFrames,
    backswingFrames: unit.definition.attackTiming.backswingFrames,
    ...(unit.definition.onHitSlow === undefined ? {} : { onHitSlow: unit.definition.onHitSlow }),
    ...(unit.definition.onHitPush === undefined ? {} : { onHitPush: unit.definition.onHitPush }),
  };
}

function detectAndStartAttacks(state: BattleState): void {
  for (const unit of state.units) {
    if (unit.state !== UnitState.Moving || state.tick < unit.nextAttackTick) continue;
    const nearest = findNearestDetectionDistance(state, unit);
    if (nearest !== null && nearest <= unit.definition.standingRange) {
      unit.usingCloseRangeAttack = !!unit.definition.closeRangeAttack && nearest <= unit.definition.closeRangeAttack.triggerMaxDistance;
      const attack = getActiveAttackProfile(unit);
      unit.state = UnitState.Foreswing;
      unit.stateFrame = 0;
      unit.nextAttackTick = state.tick + attack.cycleFrames;
    }
  }
}

function isInsideAttackRange(source: BattleUnit, targetX: number, attack: ActiveAttackProfile): boolean {
  const distance = signedDistance(source, targetX);
  return distance >= attack.attackMinRange && distance <= attack.attackMaxRange;
}

function makeUnitHit(source: BattleUnit, target: BattleUnit, attack: ActiveAttackProfile): UnitHit {
  return {
    targetKind: 'UNIT',
    sourceId: source.simulationId,
    targetId: target.simulationId,
    damage: getUnitAttackDamageAgainst(source.definition, target.definition, attack.attackDamage),
    ...(attack.onHitSlow === undefined ? {} : { onHitSlow: attack.onHitSlow }),
    ...(attack.onHitPush === undefined ? {} : { onHitPush: attack.onHitPush }),
  };
}

function collectHits(state: BattleState): HitEvent[] {
  const hits: HitEvent[] = [];
  for (const source of state.units) {
    const attack = getActiveAttackProfile(source);
    if (source.state !== UnitState.Foreswing || !attack.hitFrames.includes(source.stateFrame)) continue;
    const unitTargets = state.units
      .filter((target) => target.team !== source.team && isTargetable(target) && isInsideAttackRange(source, target.anchorX, attack))
      .sort((a, b) => signedDistance(source, a.anchorX) - signedDistance(source, b.anchorX) || a.simulationId - b.simulationId);
    const base = state.bases[oppositeTeam(source.team)];
    const baseIsInRange = isInsideAttackRange(source, base.anchorX, attack) && base.hp > 0;
    if (source.definition.targetMode === 'AREA') {
      for (const target of unitTargets) hits.push(makeUnitHit(source, target, attack));
      if (baseIsInRange) hits.push({ targetKind: 'BASE', targetTeam: base.team, damage: attack.attackDamage });
      continue;
    }
    const nearestUnit = unitTargets[0];
    const unitDistance = nearestUnit ? signedDistance(source, nearestUnit.anchorX) : Number.POSITIVE_INFINITY;
    const baseDistance = baseIsInRange ? signedDistance(source, base.anchorX) : Number.POSITIVE_INFINITY;
    if (nearestUnit && unitDistance <= baseDistance) {
      hits.push(makeUnitHit(source, nearestUnit, attack));
    } else if (baseIsInRange) {
      hits.push({ targetKind: 'BASE', targetTeam: base.team, damage: attack.attackDamage });
    }
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
  unit.forcedDisplacementFrames = 0;
  unit.usingCloseRangeAttack = false;
}

function enterForcedDisplacement(state: BattleState, unit: BattleUnit, distance: number, frames: number): void {
  const direction = directionFor(unit.team);
  unit.state = UnitState.ForcedDisplacement;
  unit.stateFrame = 0;
  unit.knockbackStartX = unit.anchorX;
  unit.knockbackTargetX = clamp(unit.anchorX - direction * distance, 0, state.mapLength);
  unit.forcedDisplacementFrames = frames;
  unit.usingCloseRangeAttack = false;
}

function enterReviving(state: BattleState, unit: BattleUnit): void {
  const revive = unit.definition.reviveOnce;
  if (!revive) throw new Error('enterReviving requires reviveOnce');
  unit.hp = 0;
  unit.state = UnitState.Reviving;
  unit.stateFrame = 0;
  unit.forcedDisplacementFrames = 0;
  unit.usingCloseRangeAttack = false;
  unit.reviveUsed = true;
  unit.reviveReadyTick = state.tick + revive.delayFrames;
}

function enterDying(unit: BattleUnit): void {
  unit.hp = 0;
  unit.state = UnitState.Dying;
  unit.stateFrame = 0;
  unit.forcedDisplacementFrames = 0;
  unit.usingCloseRangeAttack = false;
}

function deterministicProc(tick: number, sourceId: number, targetId: number, salt: number, chancePermille: number): boolean {
  let value = Math.imul(tick + 1, 0x9e3779b1) ^ Math.imul(sourceId + 17, 0x85ebca6b) ^ Math.imul(targetId + 31, 0xc2b2ae35) ^ salt;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) % 1000 < chancePermille;
}

function applyHitEffects(state: BattleState, unit: BattleUnit, hits: readonly UnitHit[], naturalKnockbackTriggered: boolean): void {
  if (!isTargetable(unit)) return;
  if (unit.slowUntilTick <= state.tick) {
    for (const hit of hits) {
      const slow = hit.onHitSlow;
      if (!slow || !deterministicProc(state.tick, hit.sourceId, unit.simulationId, 0x51f15e, slow.chancePermille)) continue;
      unit.slowUntilTick = state.tick + slow.durationFrames;
      unit.slowSpeedPermille = slow.speedPermille;
      break;
    }
  }
  if (naturalKnockbackTriggered) return;
  for (const hit of hits) {
    const push = hit.onHitPush;
    if (!push || push.distance === 0 || !deterministicProc(state.tick, hit.sourceId, unit.simulationId, 0x70757368, push.chancePermille)) continue;
    enterForcedDisplacement(state, unit, push.distance, push.frames);
    break;
  }
}

function applyHits(state: BattleState, hits: readonly HitEvent[]): void {
  const unitHits = new Map<number, UnitHit[]>();
  const baseDamage: Record<BattleTeam, number> = { PLAYER: 0, ENEMY: 0 };
  for (const hit of hits) {
    if (hit.targetKind === 'UNIT') {
      const list = unitHits.get(hit.targetId) ?? [];
      list.push(hit);
      unitHits.set(hit.targetId, list);
    } else baseDamage[hit.targetTeam] += hit.damage;
  }
  for (const unit of state.units) {
    const targetHits = unitHits.get(unit.simulationId) ?? [];
    const damage = targetHits.reduce((sum, hit) => sum + hit.damage, 0);
    if (damage <= 0 || !isTargetable(unit)) continue;
    const oldHp = unit.hp;
    const newHp = Math.max(0, oldHp - damage);
    unit.hp = newHp;
    if (newHp <= 0) {
      if (unit.definition.reviveOnce && !unit.reviveUsed) enterReviving(state, unit);
      else enterDying(unit);
      continue;
    }
    let crossed = 0;
    for (let index = unit.naturalKnockbacksConsumed + 1; index <= unit.definition.naturalKnockbackCount; index += 1) {
      if (oldHp > naturalThreshold(unit.definition, index) && newHp <= naturalThreshold(unit.definition, index)) crossed += 1;
    }
    const naturalKnockbackTriggered = crossed > 0;
    if (naturalKnockbackTriggered) {
      unit.naturalKnockbacksConsumed = Math.min(unit.definition.naturalKnockbackCount, unit.naturalKnockbacksConsumed + crossed);
      enterNaturalKnockback(state, unit);
    }
    applyHitEffects(state, unit, targetHits, naturalKnockbackTriggered);
  }
  for (const team of ['PLAYER', 'ENEMY'] as const) state.bases[team].hp = Math.max(0, state.bases[team].hp - baseDamage[team]);
}

export function applyAreaDamageToTeam(state: BattleState, targetTeam: BattleTeam, damage: number): number {
  if (!Number.isInteger(damage) || damage < 0) throw new Error('area damage must be a non-negative integer');
  if (damage === 0 || state.winner !== null) return 0;
  const targets = state.units.filter((unit) => unit.team === targetTeam && isTargetable(unit));
  if (targets.length === 0) return 0;
  const hits: UnitHit[] = targets.map((unit) => ({ targetKind: 'UNIT', sourceId: 0, targetId: unit.simulationId, damage }));
  applyHits(state, hits);
  state.stateHash = computeStateHash(state);
  return targets.length;
}

export function applyForcedDisplacementToTeam(
  state: BattleState,
  targetTeam: BattleTeam,
  distance: number,
  frames: number,
): number {
  if (!Number.isInteger(distance) || distance < 0) throw new Error('forced displacement distance must be a non-negative integer');
  if (!Number.isInteger(frames) || frames <= 0) throw new Error('forced displacement frames must be a positive integer');
  if (distance === 0 || state.winner !== null) return 0;
  const targets = state.units.filter((unit) => unit.team === targetTeam && isTargetable(unit));
  for (const unit of targets) enterForcedDisplacement(state, unit, distance, frames);
  if (targets.length > 0) state.stateHash = computeStateHash(state);
  return targets.length;
}

function advanceAttackPattern(unit: BattleUnit): void {
  if (unit.usingCloseRangeAttack) return;
  const pattern = unit.definition.attackPattern;
  if (!pattern) return;
  unit.attackPatternIndex = (unit.attackPatternIndex + 1) % pattern.length;
}

function finishAttackOrWait(state: BattleState, unit: BattleUnit): void {
  advanceAttackPattern(unit);
  unit.usingCloseRangeAttack = false;
  unit.state = state.tick >= unit.nextAttackTick ? UnitState.Moving : UnitState.AttackWait;
  unit.stateFrame = 0;
}

function advanceAttackStates(state: BattleState): void {
  for (const unit of state.units) {
    const attack = getActiveAttackProfile(unit);
    if (unit.state === UnitState.Foreswing) {
      if (unit.stateFrame >= attack.hitFrames[attack.hitFrames.length - 1]!) {
        if (attack.backswingFrames === 0) finishAttackOrWait(state, unit);
        else {
          unit.state = UnitState.Backswing;
          unit.stateFrame = 0;
        }
      }
    } else if (unit.state === UnitState.Backswing && unit.stateFrame >= attack.backswingFrames) {
      finishAttackOrWait(state, unit);
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

function slowSignature(effect: OnHitSlowDefinition | undefined): string {
  return effect ? `${effect.chancePermille}:${effect.durationFrames}:${effect.speedPermille}` : '-';
}
function pushSignature(effect: OnHitPushDefinition | undefined): string {
  return effect ? `${effect.chancePermille}:${effect.distance}:${effect.frames}` : '-';
}
function attackStepSignature(step: AttackPatternStep): string {
  return [step.attackDamage, step.attackMinRange, step.attackMaxRange, step.cycleFrames, step.hitFrames.join(','), slowSignature(step.onHitSlow), pushSignature(step.onHitPush)].join(':');
}

export function getBattleUnitDefinitionSignature(definition: BattleUnitDefinition): string {
  const attributes = [...(definition.attributes ?? [])].sort().join(',');
  const tags = [...(definition.combatTags ?? [])].sort().join(',');
  const bonuses = [...(definition.damageBonuses ?? [])]
    .sort((a, b) => `${a.targetKind}:${a.target}`.localeCompare(`${b.targetKind}:${b.target}`))
    .map((bonus) => `${bonus.targetKind}:${bonus.target}:${bonus.multiplierPermille}`)
    .join(',');
  const timing = definition.attackTiming;
  const parts = [
    definition.id,
    definition.maxHp,
    definition.attackDamage,
    definition.moveSpeed,
    definition.standingRange,
    definition.attackMinRange,
    definition.attackMaxRange,
    definition.targetMode,
    definition.naturalKnockbackCount,
    definition.naturalKnockbackFrames,
    definition.naturalKnockbackDistance,
    definition.deathFrames,
    timing.cycleFrames,
    timing.hitFrames.join(','),
    timing.backswingFrames,
    `[${attributes}]`,
    `[${tags}]`,
    `[${bonuses}]`,
    `[slow:${slowSignature(definition.onHitSlow)}]`,
    `[push:${pushSignature(definition.onHitPush)}]`,
    `[revive:${definition.reviveOnce ? `${definition.reviveOnce.delayFrames}:${definition.reviveOnce.hpPermille}` : '-'}]`,
  ];
  if (definition.attackPattern) parts.push(`[pattern:${definition.attackPattern.map(attackStepSignature).join(';')}]`);
  if (definition.closeRangeAttack) parts.push(`[close:${definition.closeRangeAttack.triggerMaxDistance}:${attackStepSignature(definition.closeRangeAttack)}]`);
  return parts.join('/');
}

export function computeStateHash(state: BattleState): string {
  const units = [...state.units]
    .sort((a, b) => a.simulationId - b.simulationId)
    .map((unit) => {
      const fields: Array<string | number> = [
        unit.simulationId,
        getBattleUnitDefinitionSignature(unit.definition),
        unit.team,
        unit.hp,
        unit.anchorX,
        unit.state,
        unit.stateFrame,
        unit.nextAttackTick,
        unit.attackPatternIndex,
        unit.usingCloseRangeAttack ? 1 : 0,
        unit.naturalKnockbacksConsumed,
        unit.knockbackStartX,
        unit.knockbackTargetX,
        unit.forcedDisplacementFrames,
        unit.slowUntilTick,
        unit.slowSpeedPermille,
        unit.reviveUsed ? 1 : 0,
        unit.reviveReadyTick,
      ];
      return fields.join(':');
    })
    .join('|');
  const bases = [
    state.bases.PLAYER.anchorX,
    state.bases.PLAYER.maxHp,
    state.bases.PLAYER.hp,
    state.bases.ENEMY.anchorX,
    state.bases.ENEMY.maxHp,
    state.bases.ENEMY.hp,
  ].join(':');
  return fnv1a([state.tick, state.nextSimulationId, state.mapLength, bases, state.winner ?? '-', units].join('#'));
}