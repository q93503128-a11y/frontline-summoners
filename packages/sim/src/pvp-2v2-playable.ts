import { SIM_TICK_RATE, UnitState, applyAreaDamageToTeam, applyDamageTakenModifierToUnitIds, applyForcedDisplacementToUnit, computeStateHash, createBattle, getBattleUnitDefinitionSignature, spawnUnit, stepBattle, type BattleState, type BattleTeam } from './index.ts';
import { PVP_MATCH_TIME_LIMIT_FRAMES, resolvePvpTimedResult, type PvpTimedResult } from './pvp-content.ts';
import { DEFAULT_SUPPLY_LEVELS, MIN_PLAYER_RECHARGE_FRAMES, type BaseWeaponDefinition, type PlayerRosterSlot, type SupplyLevelDefinition } from './playable.ts';

export const PVP_2V2_SEAT_IDS = ['A1', 'A2', 'B1', 'B2'] as const;
export type Pvp2v2SeatId = (typeof PVP_2V2_SEAT_IDS)[number];
export type Pvp2v2TeamId = 'A' | 'B';

export interface Pvp2v2SeatConfig {
  readonly slots: readonly PlayerRosterSlot[];
  readonly startingSupply?: number;
  readonly supplyLevels?: readonly SupplyLevelDefinition[];
}

export interface Pvp2v2TeamConfig {
  readonly players: readonly [Pvp2v2SeatConfig, Pvp2v2SeatConfig];
  readonly baseWeapon: BaseWeaponDefinition;
  readonly unitCap?: number;
}

export interface Pvp2v2BattleConfig {
  readonly mapLength: number;
  readonly baseHp: number;
  readonly teamA: Pvp2v2TeamConfig;
  readonly teamB: Pvp2v2TeamConfig;
  readonly timeLimitFrames?: number;
}

export interface Pvp2v2SeatState {
  readonly seatId: Pvp2v2SeatId;
  readonly teamId: Pvp2v2TeamId;
  readonly team: BattleTeam;
  supply: number;
  supplyLevel: number;
  incomeRemainder: number;
  readonly supplyLevels: readonly SupplyLevelDefinition[];
  readonly slots: readonly PlayerRosterSlot[];
  readonly cooldownReadyTick: Record<string, number>;
}

export interface Pvp2v2TeamState {
  readonly teamId: Pvp2v2TeamId;
  readonly team: BattleTeam;
  readonly unitCap: number;
  readonly baseWeapon: BaseWeaponDefinition;
  baseWeaponReadyTick: number;
  baseWeaponPending: boolean;
  baseWeaponResolveTick: number;
  baseWeaponPendingSupplySeatId: Pvp2v2SeatId | null;
  baseWeaponLastActivatedSeatId: Pvp2v2SeatId | null;
  readonly baseWeaponSnapshotSimulationIds: number[];
}

export interface Pvp2v2BattleState {
  readonly battle: BattleState;
  readonly seats: Record<Pvp2v2SeatId, Pvp2v2SeatState>;
  readonly teams: Record<Pvp2v2TeamId, Pvp2v2TeamState>;
  readonly ownerBySimulationId: Record<string, Pvp2v2SeatId>;
  readonly timeLimitFrames: number;
  aBaseDamageDealt: number;
  bBaseDamageDealt: number;
  timedResult: PvpTimedResult | null;
  stateHash: string;
}

export type Pvp2v2SpawnResult = { readonly ok: true; readonly simulationId: number } | { readonly ok: false; readonly reason: 'battle_over' | 'unknown_slot' | 'insufficient_supply' | 'cooldown' | 'unit_cap' };
export type Pvp2v2UpgradeResult = { readonly ok: true; readonly level: number } | { readonly ok: false; readonly reason: 'battle_over' | 'max_level' | 'insufficient_supply' };
export type Pvp2v2WeaponResult = { readonly ok: true; readonly readyTick: number } | { readonly ok: false; readonly reason: 'battle_over' | 'cooldown' | 'already_pending' };

function teamFor(teamId: Pvp2v2TeamId): BattleTeam { return teamId === 'A' ? 'PLAYER' : 'ENEMY'; }
export function getPvp2v2SeatTeamId(seatId: Pvp2v2SeatId): Pvp2v2TeamId { return seatId.startsWith('A') ? 'A' : 'B'; }
function opposingTeam(team: BattleTeam): BattleTeam { return team === 'PLAYER' ? 'ENEMY' : 'PLAYER'; }
function assertPositive(value: number, context: string): void { if (!Number.isInteger(value) || value <= 0) throw new Error(`${context} must be positive`); }
function assertNonNegative(value: number, context: string): void { if (!Number.isInteger(value) || value < 0) throw new Error(`${context} must be non-negative`); }

function validateSupplyLevels(levels: readonly SupplyLevelDefinition[], context: string): void {
  if (levels.length === 0) throw new Error(`${context} must not be empty`);
  levels.forEach((level, index) => {
    assertNonNegative(level.incomePerSecond, `${context}[${index}].incomePerSecond`);
    assertPositive(level.maxSupply, `${context}[${index}].maxSupply`);
    assertNonNegative(level.upgradeCost, `${context}[${index}].upgradeCost`);
    if (index === 0 && level.upgradeCost !== 0) throw new Error(`${context}[0].upgradeCost must be 0`);
  });
}

function validateSlots(slots: readonly PlayerRosterSlot[], context: string): void {
  if (slots.length !== 5) throw new Error(`${context} must contain exactly 5 slots for 2v2`);
  const ids = slots.map((slot) => slot.slotId);
  if (new Set(ids).size !== ids.length) throw new Error(`${context} slot ids must be unique`);
  for (const slot of slots) {
    assertNonNegative(slot.cost, `${context}.${slot.slotId}.cost`);
    assertPositive(slot.rechargeFrames, `${context}.${slot.slotId}.rechargeFrames`);
    if (slot.rechargeFrames < MIN_PLAYER_RECHARGE_FRAMES) throw new Error(`${context}.${slot.slotId}.rechargeFrames below canonical floor`);
  }
}

function weaponKind(weapon: BaseWeaponDefinition): 'FRONT_CANNON' | 'AEGIS_EMITTER' | 'SUPPLY_DROP' { return weapon.kind ?? 'FRONT_CANNON'; }
function validateWeapon(weapon: BaseWeaponDefinition, context: string): void {
  assertNonNegative(weapon.damage, `${context}.damage`);
  assertPositive(weapon.cooldownFrames, `${context}.cooldownFrames`);
  assertNonNegative(weapon.pushDistance, `${context}.pushDistance`);
  assertPositive(weapon.pushFrames, `${context}.pushFrames`);
}

function makeSeat(seatId: Pvp2v2SeatId, config: Pvp2v2SeatConfig): Pvp2v2SeatState {
  const teamId = getPvp2v2SeatTeamId(seatId);
  const supplyLevels = config.supplyLevels ?? DEFAULT_SUPPLY_LEVELS;
  validateSupplyLevels(supplyLevels, `${seatId}.supplyLevels`);
  validateSlots(config.slots, `${seatId}.slots`);
  const startingSupply = config.startingSupply ?? 0;
  assertNonNegative(startingSupply, `${seatId}.startingSupply`);
  return {
    seatId,
    teamId,
    team: teamFor(teamId),
    supply: Math.min(startingSupply, supplyLevels[0]!.maxSupply),
    supplyLevel: 0,
    incomeRemainder: 0,
    supplyLevels,
    slots: config.slots,
    cooldownReadyTick: {},
  };
}

function makeTeam(teamId: Pvp2v2TeamId, config: Pvp2v2TeamConfig): Pvp2v2TeamState {
  validateWeapon(config.baseWeapon, `${teamId}.baseWeapon`);
  const unitCap = config.unitCap ?? 55;
  assertPositive(unitCap, `${teamId}.unitCap`);
  return {
    teamId,
    team: teamFor(teamId),
    unitCap,
    baseWeapon: config.baseWeapon,
    baseWeaponReadyTick: config.baseWeapon.initialCooldownFrames ?? 0,
    baseWeaponPending: false,
    baseWeaponResolveTick: -1,
    baseWeaponPendingSupplySeatId: null,
    baseWeaponLastActivatedSeatId: null,
    baseWeaponSnapshotSimulationIds: [],
  };
}

export function createPvp2v2Battle(config: Pvp2v2BattleConfig): Pvp2v2BattleState {
  assertPositive(config.mapLength, 'mapLength');
  assertPositive(config.baseHp, 'baseHp');
  const timeLimitFrames = config.timeLimitFrames ?? PVP_MATCH_TIME_LIMIT_FRAMES;
  assertPositive(timeLimitFrames, 'timeLimitFrames');
  const state: Pvp2v2BattleState = {
    battle: createBattle({ mapLength: config.mapLength, playerBaseHp: config.baseHp, enemyBaseHp: config.baseHp }),
    seats: {
      A1: makeSeat('A1', config.teamA.players[0]), A2: makeSeat('A2', config.teamA.players[1]),
      B1: makeSeat('B1', config.teamB.players[0]), B2: makeSeat('B2', config.teamB.players[1]),
    },
    teams: { A: makeTeam('A', config.teamA), B: makeTeam('B', config.teamB) },
    ownerBySimulationId: {},
    timeLimitFrames,
    aBaseDamageDealt: 0,
    bBaseDamageDealt: 0,
    timedResult: null,
    stateHash: '',
  };
  state.stateHash = computePvp2v2StateHash(state);
  return state;
}

function currentLevel(seat: Pvp2v2SeatState): SupplyLevelDefinition { return seat.supplyLevels[seat.supplyLevel]!; }
function nextLevel(seat: Pvp2v2SeatState): SupplyLevelDefinition | null { return seat.supplyLevels[seat.supplyLevel + 1] ?? null; }
function aliveTeamUnits(state: Pvp2v2BattleState, team: BattleTeam): number { return state.battle.units.filter((unit) => unit.team === team && unit.state !== UnitState.Dying && unit.state !== UnitState.Reviving).length; }

export function getPvp2v2CooldownRemaining(state: Pvp2v2BattleState, seatId: Pvp2v2SeatId, slotId: string): number { return Math.max(0, (state.seats[seatId].cooldownReadyTick[slotId] ?? 0) - state.battle.tick); }
export function getPvp2v2WeaponCooldownRemaining(state: Pvp2v2BattleState, teamId: Pvp2v2TeamId): number { return Math.max(0, state.teams[teamId].baseWeaponReadyTick - state.battle.tick); }

export function trySpawnPvp2v2Unit(state: Pvp2v2BattleState, seatId: Pvp2v2SeatId, slotId: string): Pvp2v2SpawnResult {
  if (state.battle.winner !== null) return { ok: false, reason: 'battle_over' };
  const seat = state.seats[seatId];
  const slot = seat.slots.find((candidate) => candidate.slotId === slotId);
  if (!slot) return { ok: false, reason: 'unknown_slot' };
  if (seat.supply < slot.cost) return { ok: false, reason: 'insufficient_supply' };
  if (getPvp2v2CooldownRemaining(state, seatId, slotId) > 0) return { ok: false, reason: 'cooldown' };
  if (aliveTeamUnits(state, seat.team) >= state.teams[seat.teamId].unitCap) return { ok: false, reason: 'unit_cap' };
  const anchorX = seat.team === 'PLAYER' ? Math.min(24, state.battle.mapLength) : Math.max(0, state.battle.mapLength - 24);
  const unit = spawnUnit(state.battle, slot.definition, seat.team, anchorX);
  state.ownerBySimulationId[String(unit.simulationId)] = seatId;
  seat.supply -= slot.cost;
  seat.cooldownReadyTick[slotId] = state.battle.tick + Math.max(MIN_PLAYER_RECHARGE_FRAMES, slot.rechargeFrames);
  state.stateHash = computePvp2v2StateHash(state);
  return { ok: true, simulationId: unit.simulationId };
}

export function tryUpgradePvp2v2Supply(state: Pvp2v2BattleState, seatId: Pvp2v2SeatId): Pvp2v2UpgradeResult {
  if (state.battle.winner !== null) return { ok: false, reason: 'battle_over' };
  const seat = state.seats[seatId];
  const next = nextLevel(seat);
  if (!next) return { ok: false, reason: 'max_level' };
  if (seat.supply < next.upgradeCost) return { ok: false, reason: 'insufficient_supply' };
  seat.supply -= next.upgradeCost;
  seat.supplyLevel += 1;
  state.stateHash = computePvp2v2StateHash(state);
  return { ok: true, level: seat.supplyLevel + 1 };
}

function applyAegis(state: Pvp2v2BattleState, teamState: Pvp2v2TeamState): void {
  const ids = state.battle.units.filter((unit) => unit.team === teamState.team && unit.state !== UnitState.Dying && unit.state !== UnitState.Reviving).map((unit) => unit.simulationId);
  teamState.baseWeaponSnapshotSimulationIds.splice(0, teamState.baseWeaponSnapshotSimulationIds.length, ...ids);
  applyDamageTakenModifierToUnitIds(state.battle, teamState.team, ids, teamState.baseWeapon.durationFrames ?? 150, teamState.baseWeapon.damageTakenPermille ?? 750);
}

export function tryFirePvp2v2BaseWeapon(state: Pvp2v2BattleState, seatId: Pvp2v2SeatId): Pvp2v2WeaponResult {
  if (state.battle.winner !== null) return { ok: false, reason: 'battle_over' };
  const seat = state.seats[seatId];
  const teamState = state.teams[seat.teamId];
  if (teamState.baseWeaponPending) return { ok: false, reason: 'already_pending' };
  if (getPvp2v2WeaponCooldownRemaining(state, seat.teamId) > 0) return { ok: false, reason: 'cooldown' };
  teamState.baseWeaponReadyTick = state.battle.tick + teamState.baseWeapon.cooldownFrames;
  teamState.baseWeaponLastActivatedSeatId = seatId;
  teamState.baseWeaponSnapshotSimulationIds.length = 0;
  if (weaponKind(teamState.baseWeapon) === 'AEGIS_EMITTER') applyAegis(state, teamState);
  else {
    teamState.baseWeaponPending = true;
    teamState.baseWeaponResolveTick = state.battle.tick + (teamState.baseWeapon.hitDelayFrames ?? 0);
    teamState.baseWeaponPendingSupplySeatId = weaponKind(teamState.baseWeapon) === 'SUPPLY_DROP' ? seatId : null;
  }
  state.stateHash = computePvp2v2StateHash(state);
  return { ok: true, readyTick: teamState.baseWeaponReadyTick };
}

function accrueSupply(seat: Pvp2v2SeatState): void {
  const level = currentLevel(seat);
  seat.incomeRemainder += level.incomePerSecond;
  const gained = Math.trunc(seat.incomeRemainder / SIM_TICK_RATE);
  seat.incomeRemainder %= SIM_TICK_RATE;
  if (gained > 0) seat.supply = Math.min(level.maxSupply, seat.supply + gained);
}
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }

function processFrontCannon(state: Pvp2v2BattleState, teamState: Pvp2v2TeamState): void {
  const targetTeam = opposingTeam(teamState.team);
  applyAreaDamageToTeam(state.battle, targetTeam, teamState.baseWeapon.damage);
  const bossPushDistance = teamState.baseWeapon.bossPushDistance ?? teamState.baseWeapon.pushDistance;
  for (const unit of state.battle.units) {
    if (unit.team !== targetTeam || unit.state === UnitState.Dying || unit.state === UnitState.Reviving || unit.state === UnitState.NaturalKnockback) continue;
    const tags = new Set(unit.definition.combatTags ?? []);
    if (tags.has('STRUCTURE')) continue;
    const distance = tags.has('BOSS') ? bossPushDistance : teamState.baseWeapon.pushDistance;
    if (distance > 0) applyForcedDisplacementToUnit(state.battle, unit, distance, teamState.baseWeapon.pushFrames);
  }
}

function processSupplyDrop(state: Pvp2v2BattleState, teamState: Pvp2v2TeamState): void {
  const seatId = teamState.baseWeaponPendingSupplySeatId;
  if (!seatId) return;
  const seat = state.seats[seatId];
  const maxSupply = currentLevel(seat).maxSupply;
  const gain = clamp(Math.round(maxSupply * (teamState.baseWeapon.supplyGainPermille ?? 180) / 1000), teamState.baseWeapon.supplyGainMin ?? 120, teamState.baseWeapon.supplyGainMax ?? 900);
  seat.supply = Math.min(maxSupply, seat.supply + gain);
}

function processPendingWeapon(state: Pvp2v2BattleState, teamState: Pvp2v2TeamState): void {
  if (!teamState.baseWeaponPending || state.battle.tick < teamState.baseWeaponResolveTick) return;
  teamState.baseWeaponPending = false;
  teamState.baseWeaponResolveTick = -1;
  if (weaponKind(teamState.baseWeapon) === 'SUPPLY_DROP') processSupplyDrop(state, teamState);
  else processFrontCannon(state, teamState);
  teamState.baseWeaponPendingSupplySeatId = null;
}

function forceTimedWinner(state: Pvp2v2BattleState): void {
  if (state.battle.winner !== null || state.battle.tick < state.timeLimitFrames) return;
  const a = state.battle.bases.PLAYER;
  const b = state.battle.bases.ENEMY;
  const result = resolvePvpTimedResult({ aBaseHp: a.hp, aBaseMaxHp: a.maxHp, bBaseHp: b.hp, bBaseMaxHp: b.maxHp, aBaseDamageDealt: state.aBaseDamageDealt, bBaseDamageDealt: state.bBaseDamageDealt });
  state.timedResult = result;
  state.battle.winner = result === 'A' ? 'PLAYER' : result === 'B' ? 'ENEMY' : 'DRAW';
  state.battle.stateHash = computeStateHash(state.battle);
}

export function stepPvp2v2Battle(state: Pvp2v2BattleState): Pvp2v2BattleState {
  if (state.battle.winner !== null) return state;
  for (const seatId of PVP_2V2_SEAT_IDS) accrueSupply(state.seats[seatId]);
  processPendingWeapon(state, state.teams.A);
  processPendingWeapon(state, state.teams.B);
  const aBefore = state.battle.bases.PLAYER.hp;
  const bBefore = state.battle.bases.ENEMY.hp;
  stepBattle(state.battle);
  state.bBaseDamageDealt += Math.max(0, aBefore - state.battle.bases.PLAYER.hp);
  state.aBaseDamageDealt += Math.max(0, bBefore - state.battle.bases.ENEMY.hp);
  forceTimedWinner(state);
  state.stateHash = computePvp2v2StateHash(state);
  return state;
}

function fnv1a(text: string): string { let hash = 0x811c9dc5; for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 0x01000193); } return (hash >>> 0).toString(16).padStart(8, '0'); }
function weaponSignature(weapon: BaseWeaponDefinition): string { return [weapon.id ?? '-', weaponKind(weapon), weapon.damage, weapon.cooldownFrames, weapon.pushDistance, weapon.pushFrames, weapon.initialCooldownFrames ?? 0, weapon.hitDelayFrames ?? 0, weapon.bossPushDistance ?? -1, weapon.damageTakenPermille ?? -1, weapon.durationFrames ?? -1, weapon.supplyGainPermille ?? -1, weapon.supplyGainMin ?? -1, weapon.supplyGainMax ?? -1].join(':'); }
function seatSignature(seat: Pvp2v2SeatState): string {
  const levels = seat.supplyLevels.map((level) => `${level.incomePerSecond}:${level.maxSupply}:${level.upgradeCost}`).join('|');
  const slots = [...seat.slots].sort((a, b) => a.slotId.localeCompare(b.slotId)).map((slot) => `${slot.slotId}:${slot.cost}:${slot.rechargeFrames}:${getBattleUnitDefinitionSignature(slot.definition)}`).join('|');
  const cooldowns = Object.entries(seat.cooldownReadyTick).sort(([a], [b]) => a.localeCompare(b)).map(([id, tick]) => `${id}:${tick}`).join('|');
  return [seat.seatId, seat.teamId, seat.supply, seat.supplyLevel, seat.incomeRemainder, levels, slots, cooldowns].join('#');
}
function teamSignature(team: Pvp2v2TeamState): string { return [team.teamId, team.unitCap, weaponSignature(team.baseWeapon), team.baseWeaponReadyTick, team.baseWeaponPending ? 1 : 0, team.baseWeaponResolveTick, team.baseWeaponPendingSupplySeatId ?? '-', team.baseWeaponLastActivatedSeatId ?? '-', team.baseWeaponSnapshotSimulationIds.join(',')].join(':'); }

export function computePvp2v2StateHash(state: Pvp2v2BattleState): string {
  const owners = Object.entries(state.ownerBySimulationId).sort(([a], [b]) => Number(a) - Number(b)).map(([id, seat]) => `${id}:${seat}`).join('|');
  return fnv1a([computeStateHash(state.battle), ...PVP_2V2_SEAT_IDS.map((seatId) => seatSignature(state.seats[seatId])), teamSignature(state.teams.A), teamSignature(state.teams.B), owners, state.timeLimitFrames, state.aBaseDamageDealt, state.bBaseDamageDealt, state.timedResult ?? '-'].join('##'));
}
