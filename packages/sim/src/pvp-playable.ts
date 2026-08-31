import {
  UnitState,
  applyAreaDamageToTeam,
  applyDamageTakenModifierToUnitIds,
  applyForcedDisplacementToUnit,
  computeStateHash,
  createBattle,
  getBattleUnitDefinitionSignature,
  spawnUnit,
  stepBattle,
  type BattleState,
  type BattleTeam,
} from './index.ts';
import {
  DEFAULT_SUPPLY_LEVELS,
  MIN_PLAYER_RECHARGE_FRAMES,
  type BaseWeaponDefinition,
  type PlayerRosterSlot,
  type SupplyLevelDefinition,
} from './playable.ts';
import { PVP_MATCH_TIME_LIMIT_FRAMES, resolvePvpTimedResult, type PvpTimedResult } from './pvp-content.ts';
import { SIM_TICK_RATE } from '@frontline/shared';

export type Pvp1v1SideId = 'A' | 'B';
export type Pvp1v1SpawnFailure = 'battle_over' | 'unknown_slot' | 'insufficient_supply' | 'cooldown' | 'unit_cap';
export type Pvp1v1UpgradeFailure = 'battle_over' | 'max_level' | 'insufficient_supply';
export type Pvp1v1WeaponFailure = 'battle_over' | 'cooldown' | 'already_pending';

export type Pvp1v1SpawnResult = { readonly ok: true; readonly simulationId: number } | { readonly ok: false; readonly reason: Pvp1v1SpawnFailure };
export type Pvp1v1UpgradeResult = { readonly ok: true; readonly level: number } | { readonly ok: false; readonly reason: Pvp1v1UpgradeFailure };
export type Pvp1v1WeaponResult = { readonly ok: true; readonly readyTick: number } | { readonly ok: false; readonly reason: Pvp1v1WeaponFailure };

export interface Pvp1v1SideConfig {
  readonly slots: readonly PlayerRosterSlot[];
  readonly baseWeapon: BaseWeaponDefinition;
  readonly startingSupply?: number;
  readonly supplyLevels?: readonly SupplyLevelDefinition[];
  readonly unitCap?: number;
}

export interface Pvp1v1BattleConfig {
  readonly mapLength: number;
  readonly baseHp: number;
  readonly sideA: Pvp1v1SideConfig;
  readonly sideB: Pvp1v1SideConfig;
  readonly timeLimitFrames?: number;
}

export interface Pvp1v1SideState {
  readonly sideId: Pvp1v1SideId;
  readonly team: BattleTeam;
  supply: number;
  supplyLevel: number;
  incomeRemainder: number;
  readonly supplyLevels: readonly SupplyLevelDefinition[];
  readonly slots: readonly PlayerRosterSlot[];
  readonly cooldownReadyTick: Record<string, number>;
  readonly unitCap: number;
  readonly baseWeapon: BaseWeaponDefinition;
  baseWeaponReadyTick: number;
  baseWeaponPending: boolean;
  baseWeaponResolveTick: number;
  readonly baseWeaponSnapshotSimulationIds: number[];
}

export interface Pvp1v1BattleState {
  readonly battle: BattleState;
  readonly sides: Record<Pvp1v1SideId, Pvp1v1SideState>;
  readonly timeLimitFrames: number;
  aBaseDamageDealt: number;
  bBaseDamageDealt: number;
  timedResult: PvpTimedResult | null;
  stateHash: string;
}

function sideTeam(sideId: Pvp1v1SideId): BattleTeam {
  return sideId === 'A' ? 'PLAYER' : 'ENEMY';
}

function opposingTeam(team: BattleTeam): BattleTeam {
  return team === 'PLAYER' ? 'ENEMY' : 'PLAYER';
}

function assertPositiveInteger(value: number, context: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${context} must be positive`);
}

function assertNonNegativeInteger(value: number, context: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${context} must be non-negative`);
}

function validateSupplyLevels(levels: readonly SupplyLevelDefinition[], context: string): void {
  if (levels.length === 0) throw new Error(`${context} must not be empty`);
  levels.forEach((level, index) => {
    assertNonNegativeInteger(level.incomePerSecond, `${context}[${index}].incomePerSecond`);
    assertPositiveInteger(level.maxSupply, `${context}[${index}].maxSupply`);
    assertNonNegativeInteger(level.upgradeCost, `${context}[${index}].upgradeCost`);
    if (index === 0 && level.upgradeCost !== 0) throw new Error(`${context}[0].upgradeCost must be 0`);
    if (index > 0) {
      const previous = levels[index - 1]!;
      if (level.incomePerSecond < previous.incomePerSecond) throw new Error(`${context} income must not decrease`);
      if (level.maxSupply < previous.maxSupply) throw new Error(`${context} maxSupply must not decrease`);
    }
  });
}

function validateSlots(slots: readonly PlayerRosterSlot[], context: string): void {
  if (slots.length !== 10) throw new Error(`${context} must contain exactly 10 slots for 1v1`);
  const ids = new Set<string>();
  for (const slot of slots) {
    if (!slot.slotId || ids.has(slot.slotId)) throw new Error(`${context} slot ids must be unique`);
    ids.add(slot.slotId);
    assertNonNegativeInteger(slot.cost, `${context}.${slot.slotId}.cost`);
    assertPositiveInteger(slot.rechargeFrames, `${context}.${slot.slotId}.rechargeFrames`);
    if (slot.rechargeFrames < MIN_PLAYER_RECHARGE_FRAMES) throw new Error(`${context}.${slot.slotId}.rechargeFrames below canonical floor`);
  }
}

function weaponKind(weapon: BaseWeaponDefinition): 'FRONT_CANNON' | 'AEGIS_EMITTER' | 'SUPPLY_DROP' {
  return weapon.kind ?? 'FRONT_CANNON';
}

function validateWeapon(weapon: BaseWeaponDefinition, context: string): void {
  assertNonNegativeInteger(weapon.damage, `${context}.damage`);
  assertPositiveInteger(weapon.cooldownFrames, `${context}.cooldownFrames`);
  assertNonNegativeInteger(weapon.pushDistance, `${context}.pushDistance`);
  assertPositiveInteger(weapon.pushFrames, `${context}.pushFrames`);
  if (weapon.initialCooldownFrames !== undefined) assertNonNegativeInteger(weapon.initialCooldownFrames, `${context}.initialCooldownFrames`);
  if (weapon.hitDelayFrames !== undefined) assertNonNegativeInteger(weapon.hitDelayFrames, `${context}.hitDelayFrames`);
  if (weapon.bossPushDistance !== undefined) assertNonNegativeInteger(weapon.bossPushDistance, `${context}.bossPushDistance`);
  if (weapon.damageTakenPermille !== undefined && (!Number.isInteger(weapon.damageTakenPermille) || weapon.damageTakenPermille < 1 || weapon.damageTakenPermille > 1000)) throw new Error(`${context}.damageTakenPermille invalid`);
  if (weapon.durationFrames !== undefined) assertPositiveInteger(weapon.durationFrames, `${context}.durationFrames`);
  if (weapon.supplyGainPermille !== undefined && (!Number.isInteger(weapon.supplyGainPermille) || weapon.supplyGainPermille < 0 || weapon.supplyGainPermille > 1000)) throw new Error(`${context}.supplyGainPermille invalid`);
  if (weapon.supplyGainMin !== undefined) assertNonNegativeInteger(weapon.supplyGainMin, `${context}.supplyGainMin`);
  if (weapon.supplyGainMax !== undefined) assertNonNegativeInteger(weapon.supplyGainMax, `${context}.supplyGainMax`);
  if (weapon.supplyGainMin !== undefined && weapon.supplyGainMax !== undefined && weapon.supplyGainMin > weapon.supplyGainMax) throw new Error(`${context} supply gain min > max`);
  if (weaponKind(weapon) === 'AEGIS_EMITTER' && (weapon.damageTakenPermille === undefined || weapon.durationFrames === undefined)) throw new Error(`${context} aegis fields missing`);
  if (weaponKind(weapon) === 'SUPPLY_DROP' && (weapon.supplyGainPermille === undefined || weapon.supplyGainMin === undefined || weapon.supplyGainMax === undefined)) throw new Error(`${context} supply drop fields missing`);
}

function makeSide(sideId: Pvp1v1SideId, config: Pvp1v1SideConfig): Pvp1v1SideState {
  const levels = config.supplyLevels ?? DEFAULT_SUPPLY_LEVELS;
  validateSupplyLevels(levels, `${sideId}.supplyLevels`);
  validateSlots(config.slots, `${sideId}.slots`);
  validateWeapon(config.baseWeapon, `${sideId}.baseWeapon`);
  const startingSupply = config.startingSupply ?? 0;
  assertNonNegativeInteger(startingSupply, `${sideId}.startingSupply`);
  const unitCap = config.unitCap ?? 40;
  assertPositiveInteger(unitCap, `${sideId}.unitCap`);
  return {
    sideId,
    team: sideTeam(sideId),
    supply: Math.min(levels[0]!.maxSupply, startingSupply),
    supplyLevel: 0,
    incomeRemainder: 0,
    supplyLevels: levels,
    slots: config.slots,
    cooldownReadyTick: {},
    unitCap,
    baseWeapon: config.baseWeapon,
    baseWeaponReadyTick: config.baseWeapon.initialCooldownFrames ?? 0,
    baseWeaponPending: false,
    baseWeaponResolveTick: -1,
    baseWeaponSnapshotSimulationIds: [],
  };
}

export function createPvp1v1Battle(config: Pvp1v1BattleConfig): Pvp1v1BattleState {
  assertPositiveInteger(config.mapLength, 'mapLength');
  assertPositiveInteger(config.baseHp, 'baseHp');
  const timeLimitFrames = config.timeLimitFrames ?? PVP_MATCH_TIME_LIMIT_FRAMES;
  assertPositiveInteger(timeLimitFrames, 'timeLimitFrames');
  const state: Pvp1v1BattleState = {
    battle: createBattle({ mapLength: config.mapLength, playerBaseHp: config.baseHp, enemyBaseHp: config.baseHp }),
    sides: {
      A: makeSide('A', config.sideA),
      B: makeSide('B', config.sideB),
    },
    timeLimitFrames,
    aBaseDamageDealt: 0,
    bBaseDamageDealt: 0,
    timedResult: null,
    stateHash: '',
  };
  state.stateHash = computePvp1v1StateHash(state);
  return state;
}

function currentSupplyLevel(side: Pvp1v1SideState): SupplyLevelDefinition {
  return side.supplyLevels[side.supplyLevel]!;
}

function nextSupplyLevel(side: Pvp1v1SideState): SupplyLevelDefinition | null {
  return side.supplyLevels[side.supplyLevel + 1] ?? null;
}

function aliveUnitCount(state: Pvp1v1BattleState, team: BattleTeam): number {
  return state.battle.units.filter((unit) => unit.team === team && unit.state !== UnitState.Dying && unit.state !== UnitState.Reviving).length;
}

export function getPvp1v1CooldownRemaining(state: Pvp1v1BattleState, sideId: Pvp1v1SideId, slotId: string): number {
  return Math.max(0, (state.sides[sideId].cooldownReadyTick[slotId] ?? 0) - state.battle.tick);
}

export function getPvp1v1WeaponCooldownRemaining(state: Pvp1v1BattleState, sideId: Pvp1v1SideId): number {
  return Math.max(0, state.sides[sideId].baseWeaponReadyTick - state.battle.tick);
}

export function trySpawnPvp1v1Unit(state: Pvp1v1BattleState, sideId: Pvp1v1SideId, slotId: string): Pvp1v1SpawnResult {
  if (state.battle.winner !== null) return { ok: false, reason: 'battle_over' };
  const side = state.sides[sideId];
  const slot = side.slots.find((candidate) => candidate.slotId === slotId);
  if (!slot) return { ok: false, reason: 'unknown_slot' };
  if (side.supply < slot.cost) return { ok: false, reason: 'insufficient_supply' };
  if (getPvp1v1CooldownRemaining(state, sideId, slotId) > 0) return { ok: false, reason: 'cooldown' };
  if (aliveUnitCount(state, side.team) >= side.unitCap) return { ok: false, reason: 'unit_cap' };
  const anchorX = side.team === 'PLAYER' ? Math.min(24, state.battle.mapLength) : Math.max(0, state.battle.mapLength - 24);
  const unit = spawnUnit(state.battle, slot.definition, side.team, anchorX);
  side.supply -= slot.cost;
  side.cooldownReadyTick[slotId] = state.battle.tick + Math.max(MIN_PLAYER_RECHARGE_FRAMES, slot.rechargeFrames);
  state.stateHash = computePvp1v1StateHash(state);
  return { ok: true, simulationId: unit.simulationId };
}

export function tryUpgradePvp1v1Supply(state: Pvp1v1BattleState, sideId: Pvp1v1SideId): Pvp1v1UpgradeResult {
  if (state.battle.winner !== null) return { ok: false, reason: 'battle_over' };
  const side = state.sides[sideId];
  const next = nextSupplyLevel(side);
  if (!next) return { ok: false, reason: 'max_level' };
  if (side.supply < next.upgradeCost) return { ok: false, reason: 'insufficient_supply' };
  side.supply -= next.upgradeCost;
  side.supplyLevel += 1;
  state.stateHash = computePvp1v1StateHash(state);
  return { ok: true, level: side.supplyLevel };
}

function applyAegis(state: Pvp1v1BattleState, side: Pvp1v1SideState): void {
  const ids = state.battle.units
    .filter((unit) => unit.team === side.team && unit.state !== UnitState.Dying && unit.state !== UnitState.Reviving)
    .map((unit) => unit.simulationId);
  side.baseWeaponSnapshotSimulationIds.splice(0, side.baseWeaponSnapshotSimulationIds.length, ...ids);
  applyDamageTakenModifierToUnitIds(
    state.battle,
    side.team,
    ids,
    side.baseWeapon.durationFrames ?? 150,
    side.baseWeapon.damageTakenPermille ?? 750,
  );
}

export function tryFirePvp1v1BaseWeapon(state: Pvp1v1BattleState, sideId: Pvp1v1SideId): Pvp1v1WeaponResult {
  if (state.battle.winner !== null) return { ok: false, reason: 'battle_over' };
  const side = state.sides[sideId];
  if (side.baseWeaponPending) return { ok: false, reason: 'already_pending' };
  if (getPvp1v1WeaponCooldownRemaining(state, sideId) > 0) return { ok: false, reason: 'cooldown' };
  side.baseWeaponReadyTick = state.battle.tick + side.baseWeapon.cooldownFrames;
  side.baseWeaponSnapshotSimulationIds.length = 0;
  if (weaponKind(side.baseWeapon) === 'AEGIS_EMITTER') applyAegis(state, side);
  else {
    side.baseWeaponPending = true;
    side.baseWeaponResolveTick = state.battle.tick + (side.baseWeapon.hitDelayFrames ?? 0);
  }
  state.stateHash = computePvp1v1StateHash(state);
  return { ok: true, readyTick: side.baseWeaponReadyTick };
}

function accrueSupply(side: Pvp1v1SideState): void {
  const level = currentSupplyLevel(side);
  side.incomeRemainder += level.incomePerSecond;
  const gained = Math.trunc(side.incomeRemainder / SIM_TICK_RATE);
  side.incomeRemainder %= SIM_TICK_RATE;
  if (gained > 0) side.supply = Math.min(level.maxSupply, side.supply + gained);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function processFrontCannon(state: Pvp1v1BattleState, side: Pvp1v1SideState): void {
  const targetTeam = opposingTeam(side.team);
  applyAreaDamageToTeam(state.battle, targetTeam, side.baseWeapon.damage);
  const bossPushDistance = side.baseWeapon.bossPushDistance ?? side.baseWeapon.pushDistance;
  for (const unit of state.battle.units) {
    if (unit.team !== targetTeam || unit.state === UnitState.Dying || unit.state === UnitState.Reviving || unit.state === UnitState.NaturalKnockback) continue;
    const tags = new Set(unit.definition.combatTags ?? []);
    if (tags.has('STRUCTURE')) continue;
    const distance = tags.has('BOSS') ? bossPushDistance : side.baseWeapon.pushDistance;
    if (distance > 0) applyForcedDisplacementToUnit(state.battle, unit, distance, side.baseWeapon.pushFrames);
  }
}

function processSupplyDrop(side: Pvp1v1SideState): void {
  const maxSupply = currentSupplyLevel(side).maxSupply;
  const gain = clamp(
    Math.round(maxSupply * (side.baseWeapon.supplyGainPermille ?? 180) / 1000),
    side.baseWeapon.supplyGainMin ?? 120,
    side.baseWeapon.supplyGainMax ?? 900,
  );
  side.supply = Math.min(maxSupply, side.supply + gain);
}

function processPendingWeapon(state: Pvp1v1BattleState, side: Pvp1v1SideState): void {
  if (!side.baseWeaponPending || state.battle.tick < side.baseWeaponResolveTick) return;
  side.baseWeaponPending = false;
  side.baseWeaponResolveTick = -1;
  if (weaponKind(side.baseWeapon) === 'SUPPLY_DROP') processSupplyDrop(side);
  else processFrontCannon(state, side);
}

function forceTimedWinner(state: Pvp1v1BattleState): void {
  if (state.battle.winner !== null || state.battle.tick < state.timeLimitFrames) return;
  const aBase = state.battle.bases.PLAYER;
  const bBase = state.battle.bases.ENEMY;
  const result = resolvePvpTimedResult({
    aBaseHp: aBase.hp,
    aBaseMaxHp: aBase.maxHp,
    bBaseHp: bBase.hp,
    bBaseMaxHp: bBase.maxHp,
    aBaseDamageDealt: state.aBaseDamageDealt,
    bBaseDamageDealt: state.bBaseDamageDealt,
  });
  state.timedResult = result;
  state.battle.winner = result === 'A' ? 'PLAYER' : result === 'B' ? 'ENEMY' : 'DRAW';
  state.battle.stateHash = computeStateHash(state.battle);
}

export function stepPvp1v1Battle(state: Pvp1v1BattleState): Pvp1v1BattleState {
  if (state.battle.winner !== null) return state;
  accrueSupply(state.sides.A);
  accrueSupply(state.sides.B);
  processPendingWeapon(state, state.sides.A);
  processPendingWeapon(state, state.sides.B);
  const aBaseHpBefore = state.battle.bases.PLAYER.hp;
  const bBaseHpBefore = state.battle.bases.ENEMY.hp;
  stepBattle(state.battle);
  const aBaseDamage = Math.max(0, aBaseHpBefore - state.battle.bases.PLAYER.hp);
  const bBaseDamage = Math.max(0, bBaseHpBefore - state.battle.bases.ENEMY.hp);
  state.bBaseDamageDealt += aBaseDamage;
  state.aBaseDamageDealt += bBaseDamage;
  forceTimedWinner(state);
  state.stateHash = computePvp1v1StateHash(state);
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

function weaponSignature(weapon: BaseWeaponDefinition): string {
  return [
    weapon.id ?? '-', weaponKind(weapon), weapon.damage, weapon.cooldownFrames,
    weapon.pushDistance, weapon.pushFrames, weapon.initialCooldownFrames ?? 0,
    weapon.hitDelayFrames ?? 0, weapon.bossPushDistance ?? -1,
    weapon.damageTakenPermille ?? -1, weapon.durationFrames ?? -1,
    weapon.supplyGainPermille ?? -1, weapon.supplyGainMin ?? -1, weapon.supplyGainMax ?? -1,
  ].join(':');
}

function sideSignature(side: Pvp1v1SideState): string {
  const levels = side.supplyLevels.map((level) => `${level.incomePerSecond}:${level.maxSupply}:${level.upgradeCost}`).join('|');
  const slots = [...side.slots]
    .sort((a, b) => a.slotId.localeCompare(b.slotId))
    .map((slot) => `${slot.slotId}:${slot.cost}:${slot.rechargeFrames}:${getBattleUnitDefinitionSignature(slot.definition)}`)
    .join('|');
  const cooldowns = Object.entries(side.cooldownReadyTick)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slotId, tick]) => `${slotId}:${tick}`)
    .join('|');
  const weapon = [
    weaponSignature(side.baseWeapon), side.baseWeaponReadyTick,
    side.baseWeaponPending ? 1 : 0, side.baseWeaponResolveTick,
    side.baseWeaponSnapshotSimulationIds.join(','),
  ].join(':');
  return [side.sideId, side.team, side.supply, side.supplyLevel, side.incomeRemainder, side.unitCap, levels, slots, cooldowns, weapon].join('#');
}

export function computePvp1v1StateHash(state: Pvp1v1BattleState): string {
  return fnv1a([
    computeStateHash(state.battle),
    sideSignature(state.sides.A),
    sideSignature(state.sides.B),
    state.timeLimitFrames,
    state.aBaseDamageDealt,
    state.bBaseDamageDealt,
    state.timedResult ?? '-',
  ].join('##'));
}
