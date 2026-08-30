import {
  SIM_TICK_RATE,
  UnitState,
  spawnUnit,
  type BattleWinner,
} from './index.ts';
import {
  DEFAULT_BASE_WEAPON,
  DEFAULT_SUPPLY_LEVELS,
  MIN_PLAYER_RECHARGE_FRAMES,
  createPlayableBattle,
  getBaseWeaponCooldownRemaining,
  stepPlayableBattle,
  tryFireBaseWeapon,
  type BaseWeaponDefinition,
  type BaseWeaponFailureReason,
  type BaseWeaponId,
  type EnemyArchetype,
  type EnemyWaveDefinition,
  type PlayerRosterSlot,
  type PlayableBattleState,
  type SpawnFailureReason,
  type SupplyLevelDefinition,
  type UpgradeFailureReason,
} from './playable.ts';

export const COOP_PLAYABLE_SEATS = ['A', 'B'] as const;
export type CoopPlayableSeatId = (typeof COOP_PLAYABLE_SEATS)[number];

export interface CoopPlayerEconomyConfig {
  readonly startingSupply: number;
  readonly supplyLevels: readonly SupplyLevelDefinition[];
  readonly enemyRewardSupplyById: Readonly<Record<string, number>>;
}

export interface CoopPlayerEconomyState {
  readonly seatId: CoopPlayableSeatId;
  supply: number;
  supplyLevel: number;
  incomeRemainder: number;
  readonly supplyLevels: readonly SupplyLevelDefinition[];
  readonly slots: readonly PlayerRosterSlot[];
  readonly cooldownReadyTick: Record<string, number>;
}

export interface CoopPlayableBattleConfig {
  readonly mapLength: number;
  readonly playerBaseHp: number;
  readonly enemyBaseHp: number;
  readonly startingSupply?: number;
  readonly playerUnitCap?: number;
  readonly enemyUnitCap?: number;
  readonly supplyLevels?: readonly SupplyLevelDefinition[];
  readonly playerEconomies?: Readonly<Record<CoopPlayableSeatId, CoopPlayerEconomyConfig>>;
  readonly baseWeapon?: BaseWeaponDefinition;
  readonly players: Readonly<Record<CoopPlayableSeatId, readonly PlayerRosterSlot[]>>;
  readonly enemies: readonly EnemyArchetype[];
  readonly enemyWaves: readonly EnemyWaveDefinition[];
}

export interface CoopPlayableBattleState {
  readonly shared: PlayableBattleState;
  readonly players: Record<CoopPlayableSeatId, CoopPlayerEconomyState>;
  readonly enemyRewardSupplyBySeat: Record<CoopPlayableSeatId, Record<string, number>>;
  readonly rewardedEnemySimulationIds: number[];
  readonly ownerBySimulationId: Record<string, CoopPlayableSeatId>;
  baseWeaponLastActivatedSeatId: CoopPlayableSeatId | null;
  baseWeaponPendingSupplySeatId: CoopPlayableSeatId | null;
  stateHash: string;
}

export type CoopSpawnResult =
  | { readonly ok: true; readonly simulationId: number }
  | { readonly ok: false; readonly reason: SpawnFailureReason };

export type CoopUpgradeResult =
  | { readonly ok: true; readonly level: number }
  | { readonly ok: false; readonly reason: UpgradeFailureReason };

export type CoopBaseWeaponResult =
  | { readonly ok: true; readonly readyTick: number }
  | { readonly ok: false; readonly reason: BaseWeaponFailureReason };

export type CoopPlayableCommand =
  | { readonly type: 'SPAWN'; readonly slotId: string }
  | { readonly type: 'UPGRADE_SUPPLY' }
  | { readonly type: 'FIRE_BASE_WEAPON' };

export interface CoopCommandOutcome {
  readonly seatId: CoopPlayableSeatId;
  readonly commandIndex: number;
  readonly command: CoopPlayableCommand;
  readonly ok: boolean;
  readonly reason?: string;
  readonly simulationId?: number;
  readonly supplyLevel?: number;
  readonly baseWeaponReadyTick?: number;
}

export interface CoopPlayableSnapshot {
  readonly tick: number;
  readonly stateHash: string;
  readonly winner: BattleWinner;
  readonly bases: {
    readonly playerHp: number;
    readonly playerMaxHp: number;
    readonly enemyHp: number;
    readonly enemyMaxHp: number;
  };
  readonly baseWeaponId: BaseWeaponId | null;
  readonly baseWeaponCooldownFrames: number;
  readonly baseWeaponLastActivatedSeatId: CoopPlayableSeatId | null;
  readonly players: readonly {
    readonly seatId: CoopPlayableSeatId;
    readonly supply: number;
    readonly maxSupply: number;
    readonly supplyLevel: number;
    readonly nextSupplyUpgradeCost: number | null;
    readonly costs: Readonly<Record<string, number>>;
    readonly cooldowns: Readonly<Record<string, number>>;
  }[];
  readonly units: readonly {
    readonly simulationId: number;
    readonly definitionId: string;
    readonly team: 'PLAYER' | 'ENEMY';
    readonly ownerSeatId?: CoopPlayableSeatId;
    readonly hp: number;
    readonly maxHp: number;
    readonly anchorX: number;
    readonly state: string;
  }[];
}

const SHARED_ECONOMY_LEVELS: readonly SupplyLevelDefinition[] = [
  { incomePerSecond: 0, maxSupply: 1, upgradeCost: 0 },
] as const;

function assertPositiveInteger(value: number, context: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${context} must be a positive integer`);
}

function assertNonNegativeInteger(value: number, context: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${context} must be a non-negative integer`);
}

function validateSupplyLevels(levels: readonly SupplyLevelDefinition[], context = 'supplyLevels'): void {
  if (levels.length === 0) throw new Error(`${context} must not be empty`);
  levels.forEach((level, index) => {
    assertNonNegativeInteger(level.incomePerSecond, `${context}[${index}].incomePerSecond`);
    assertPositiveInteger(level.maxSupply, `${context}[${index}].maxSupply`);
    assertNonNegativeInteger(level.upgradeCost, `${context}[${index}].upgradeCost`);
    if (index === 0 && level.upgradeCost !== 0) throw new Error(`${context}[0].upgradeCost must be 0`);
  });
}

function validatePlayerSlots(seatId: CoopPlayableSeatId, slots: readonly PlayerRosterSlot[]): void {
  if (slots.length < 1 || slots.length > 5) throw new Error(`co-op seat ${seatId} must contain 1..5 slots`);
  const ids = slots.map((slot) => slot.slotId);
  if (new Set(ids).size !== ids.length) throw new Error(`co-op seat ${seatId} slot ids must be unique`);
  for (const slot of slots) {
    if (!slot.slotId) throw new Error(`co-op seat ${seatId} contains an empty slot id`);
    assertNonNegativeInteger(slot.cost, `${seatId}:${slot.slotId}.cost`);
    assertPositiveInteger(slot.rechargeFrames, `${seatId}:${slot.slotId}.rechargeFrames`);
    if (slot.rechargeFrames < MIN_PLAYER_RECHARGE_FRAMES) {
      throw new Error(`${seatId}:${slot.slotId}.rechargeFrames must be >= ${MIN_PLAYER_RECHARGE_FRAMES}`);
    }
  }
}

function runtimeSlotId(seatId: CoopPlayableSeatId, slotId: string): string {
  return `${seatId}:${slotId}`;
}

function buildSharedSlots(players: Readonly<Record<CoopPlayableSeatId, readonly PlayerRosterSlot[]>>): readonly PlayerRosterSlot[] {
  return COOP_PLAYABLE_SEATS.flatMap((seatId) => players[seatId].map((slot) => ({
    ...slot,
    slotId: runtimeSlotId(seatId, slot.slotId),
  })));
}

function createPlayerEconomy(
  seatId: CoopPlayableSeatId,
  slots: readonly PlayerRosterSlot[],
  supplyLevels: readonly SupplyLevelDefinition[],
  startingSupply: number,
): CoopPlayerEconomyState {
  return {
    seatId,
    supply: Math.min(startingSupply, supplyLevels[0]!.maxSupply),
    supplyLevel: 1,
    incomeRemainder: 0,
    supplyLevels,
    slots,
    cooldownReadyTick: Object.fromEntries(slots.map((slot) => [slot.slotId, 0])),
  };
}

function baseEnemyRewardMap(enemies: readonly EnemyArchetype[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const enemy of enemies) {
    if (result[enemy.enemyId] !== undefined) throw new Error(`duplicate enemyId: ${enemy.enemyId}`);
    assertNonNegativeInteger(enemy.rewardSupply, `enemy rewardSupply (${enemy.enemyId})`);
    result[enemy.enemyId] = enemy.rewardSupply;
  }
  return result;
}

function resolveSeatEconomy(
  config: CoopPlayableBattleConfig,
  seatId: CoopPlayableSeatId,
  defaultRewards: Readonly<Record<string, number>>,
): CoopPlayerEconomyConfig {
  const explicit = config.playerEconomies?.[seatId];
  if (!explicit) {
    const levels = config.supplyLevels ?? DEFAULT_SUPPLY_LEVELS;
    validateSupplyLevels(levels);
    const startingSupply = config.startingSupply ?? 50;
    assertNonNegativeInteger(startingSupply, 'startingSupply');
    return { startingSupply, supplyLevels: levels, enemyRewardSupplyById: defaultRewards };
  }
  validateSupplyLevels(explicit.supplyLevels, `playerEconomies.${seatId}.supplyLevels`);
  assertNonNegativeInteger(explicit.startingSupply, `playerEconomies.${seatId}.startingSupply`);
  const knownEnemyIds = new Set(Object.keys(defaultRewards));
  for (const enemyId of Object.keys(explicit.enemyRewardSupplyById)) {
    if (!knownEnemyIds.has(enemyId)) throw new Error(`playerEconomies.${seatId} contains unknown enemy reward id: ${enemyId}`);
  }
  const rewards: Record<string, number> = {};
  for (const enemyId of knownEnemyIds) {
    const reward = explicit.enemyRewardSupplyById[enemyId];
    if (reward === undefined) throw new Error(`playerEconomies.${seatId} is missing enemy reward id: ${enemyId}`);
    assertNonNegativeInteger(reward, `playerEconomies.${seatId}.enemyRewardSupplyById.${enemyId}`);
    rewards[enemyId] = reward;
  }
  return { startingSupply: explicit.startingSupply, supplyLevels: explicit.supplyLevels, enemyRewardSupplyById: rewards };
}

export function createCoopPlayableBattle(config: CoopPlayableBattleConfig): CoopPlayableBattleState {
  COOP_PLAYABLE_SEATS.forEach((seatId) => validatePlayerSlots(seatId, config.players[seatId]));
  const defaultRewards = baseEnemyRewardMap(config.enemies);
  const economyA = resolveSeatEconomy(config, 'A', defaultRewards);
  const economyB = resolveSeatEconomy(config, 'B', defaultRewards);

  const shared = createPlayableBattle({
    mapLength: config.mapLength,
    playerBaseHp: config.playerBaseHp,
    enemyBaseHp: config.enemyBaseHp,
    startingSupply: 0,
    ...(config.playerUnitCap === undefined ? {} : { playerUnitCap: config.playerUnitCap }),
    ...(config.enemyUnitCap === undefined ? {} : { enemyUnitCap: config.enemyUnitCap }),
    supplyLevels: SHARED_ECONOMY_LEVELS,
    baseWeapon: config.baseWeapon ?? DEFAULT_BASE_WEAPON,
    playerSlots: buildSharedSlots(config.players),
    enemies: config.enemies.map((enemy) => ({ ...enemy, rewardSupply: 0 })),
    enemyWaves: config.enemyWaves,
  });

  const state: CoopPlayableBattleState = {
    shared,
    players: {
      A: createPlayerEconomy('A', config.players.A, economyA.supplyLevels, economyA.startingSupply),
      B: createPlayerEconomy('B', config.players.B, economyB.supplyLevels, economyB.startingSupply),
    },
    enemyRewardSupplyBySeat: {
      A: { ...economyA.enemyRewardSupplyById },
      B: { ...economyB.enemyRewardSupplyById },
    },
    rewardedEnemySimulationIds: [],
    ownerBySimulationId: {},
    baseWeaponLastActivatedSeatId: null,
    baseWeaponPendingSupplySeatId: null,
    stateHash: '',
  };
  state.stateHash = computeCoopPlayableStateHash(state);
  return state;
}

function alivePlayerUnitCount(state: CoopPlayableBattleState): number {
  return state.shared.battle.units.filter((unit) => unit.team === 'PLAYER' && unit.state !== UnitState.Dying).length;
}

export function getCoopCurrentSupplyLevel(state: CoopPlayableBattleState, seatId: CoopPlayableSeatId): SupplyLevelDefinition {
  const player = state.players[seatId];
  return player.supplyLevels[player.supplyLevel - 1]!;
}

export function getCoopCooldownRemaining(state: CoopPlayableBattleState, seatId: CoopPlayableSeatId, slotId: string): number {
  const player = state.players[seatId];
  return Math.max(0, (player.cooldownReadyTick[slotId] ?? 0) - state.shared.battle.tick);
}

export function trySpawnCoopPlayerUnit(
  state: CoopPlayableBattleState,
  seatId: CoopPlayableSeatId,
  slotId: string,
): CoopSpawnResult {
  if (state.shared.battle.winner !== null) return { ok: false, reason: 'battle_over' };
  const player = state.players[seatId];
  const slot = player.slots.find((candidate) => candidate.slotId === slotId);
  if (!slot) return { ok: false, reason: 'unknown_slot' };
  if (player.supply < slot.cost) return { ok: false, reason: 'insufficient_supply' };
  if (getCoopCooldownRemaining(state, seatId, slotId) > 0) return { ok: false, reason: 'cooldown' };
  if (alivePlayerUnitCount(state) >= state.shared.playerUnitCap) return { ok: false, reason: 'unit_cap' };

  const unit = spawnUnit(state.shared.battle, slot.definition, 'PLAYER', Math.min(24, state.shared.battle.mapLength));
  player.supply -= slot.cost;
  player.cooldownReadyTick[slotId] = state.shared.battle.tick + Math.max(MIN_PLAYER_RECHARGE_FRAMES, slot.rechargeFrames);
  state.ownerBySimulationId[String(unit.simulationId)] = seatId;
  state.stateHash = computeCoopPlayableStateHash(state);
  return { ok: true, simulationId: unit.simulationId };
}

export function tryUpgradeCoopSupply(state: CoopPlayableBattleState, seatId: CoopPlayableSeatId): CoopUpgradeResult {
  if (state.shared.battle.winner !== null) return { ok: false, reason: 'battle_over' };
  const player = state.players[seatId];
  const next = player.supplyLevels[player.supplyLevel];
  if (!next) return { ok: false, reason: 'max_level' };
  if (player.supply < next.upgradeCost) return { ok: false, reason: 'insufficient_supply' };
  player.supply -= next.upgradeCost;
  player.supplyLevel += 1;
  state.stateHash = computeCoopPlayableStateHash(state);
  return { ok: true, level: player.supplyLevel };
}

export function tryFireCoopBaseWeapon(state: CoopPlayableBattleState, seatId: CoopPlayableSeatId): CoopBaseWeaponResult {
  const result = tryFireBaseWeapon(state.shared);
  if (!result.ok) return result;
  state.baseWeaponLastActivatedSeatId = seatId;
  state.baseWeaponPendingSupplySeatId = state.shared.baseWeapon.kind === 'SUPPLY_DROP' ? seatId : null;
  state.stateHash = computeCoopPlayableStateHash(state);
  return result;
}

function accruePlayerSupply(state: CoopPlayableBattleState, seatId: CoopPlayableSeatId): void {
  const player = state.players[seatId];
  const level = getCoopCurrentSupplyLevel(state, seatId);
  player.incomeRemainder += level.incomePerSecond;
  const gained = Math.trunc(player.incomeRemainder / SIM_TICK_RATE);
  player.incomeRemainder %= SIM_TICK_RATE;
  if (gained > 0) player.supply = Math.min(level.maxSupply, player.supply + gained);
}

function resolveCoopSupplyDropIfDue(state: CoopPlayableBattleState): void {
  const seatId = state.baseWeaponPendingSupplySeatId;
  if (seatId === null || !state.shared.baseWeaponPending || state.shared.baseWeapon.kind !== 'SUPPLY_DROP') return;
  if (state.shared.battle.tick < state.shared.baseWeaponResolveTick) return;
  const player = state.players[seatId];
  const maxSupply = getCoopCurrentSupplyLevel(state, seatId).maxSupply;
  const proportional = Math.round(maxSupply * (state.shared.baseWeapon.supplyGainPermille ?? 180) / 1000);
  const gain = Math.max(state.shared.baseWeapon.supplyGainMin ?? 120, Math.min(state.shared.baseWeapon.supplyGainMax ?? 900, proportional));
  player.supply = Math.min(maxSupply, player.supply + gain);
  state.baseWeaponPendingSupplySeatId = null;
  state.shared.baseWeaponPending = false;
  state.shared.baseWeaponResolveTick = -1;
}

function grantEnemyDeathRewards(state: CoopPlayableBattleState): void {
  const rewarded = new Set(state.rewardedEnemySimulationIds);
  for (const unit of state.shared.battle.units) {
    if (unit.team !== 'ENEMY' || unit.state !== UnitState.Dying || rewarded.has(unit.simulationId)) continue;
    for (const seatId of COOP_PLAYABLE_SEATS) {
      const reward = state.enemyRewardSupplyBySeat[seatId][unit.definition.id] ?? 0;
      if (reward <= 0) continue;
      const player = state.players[seatId];
      const maxSupply = getCoopCurrentSupplyLevel(state, seatId).maxSupply;
      player.supply = Math.min(maxSupply, player.supply + reward);
    }
    state.rewardedEnemySimulationIds.push(unit.simulationId);
    rewarded.add(unit.simulationId);
  }
}

export function stepCoopPlayableBattle(state: CoopPlayableBattleState): CoopPlayableBattleState {
  if (state.shared.battle.winner !== null) return state;
  accruePlayerSupply(state, 'A');
  accruePlayerSupply(state, 'B');
  resolveCoopSupplyDropIfDue(state);
  stepPlayableBattle(state.shared);
  grantEnemyDeathRewards(state);
  state.stateHash = computeCoopPlayableStateHash(state);
  return state;
}

export function applyCoopPlayableCommands(
  state: CoopPlayableBattleState,
  seatId: CoopPlayableSeatId,
  commands: readonly CoopPlayableCommand[],
): readonly CoopCommandOutcome[] {
  return commands.map((command, commandIndex): CoopCommandOutcome => {
    if (command.type === 'SPAWN') {
      const result = trySpawnCoopPlayerUnit(state, seatId, command.slotId);
      return result.ok
        ? { seatId, commandIndex, command, ok: true, simulationId: result.simulationId }
        : { seatId, commandIndex, command, ok: false, reason: result.reason };
    }
    if (command.type === 'UPGRADE_SUPPLY') {
      const result = tryUpgradeCoopSupply(state, seatId);
      return result.ok
        ? { seatId, commandIndex, command, ok: true, supplyLevel: result.level }
        : { seatId, commandIndex, command, ok: false, reason: result.reason };
    }
    const result = tryFireCoopBaseWeapon(state, seatId);
    return result.ok
      ? { seatId, commandIndex, command, ok: true, baseWeaponReadyTick: result.readyTick }
      : { seatId, commandIndex, command, ok: false, reason: result.reason };
  });
}

export function applyCoopPlayableFrame(
  state: CoopPlayableBattleState,
  tick: number,
  commandsBySeat: Readonly<Record<CoopPlayableSeatId, readonly CoopPlayableCommand[]>>,
): { readonly outcomes: readonly CoopCommandOutcome[]; readonly snapshot: CoopPlayableSnapshot } {
  if (tick !== state.shared.battle.tick) {
    throw new Error(`co-op frame tick ${tick} does not match simulation tick ${state.shared.battle.tick}`);
  }
  const outcomes = [
    ...applyCoopPlayableCommands(state, 'A', commandsBySeat.A),
    ...applyCoopPlayableCommands(state, 'B', commandsBySeat.B),
  ];
  stepCoopPlayableBattle(state);
  return { outcomes, snapshot: getCoopPlayableSnapshot(state) };
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function computeCoopPlayableStateHash(state: CoopPlayableBattleState): string {
  const players = COOP_PLAYABLE_SEATS.map((seatId) => {
    const player = state.players[seatId];
    const cooldowns = Object.entries(player.cooldownReadyTick)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([slotId, readyTick]) => `${slotId}:${readyTick}`)
      .join('|');
    const slots = player.slots.map((slot) => `${slot.slotId}:${slot.cost}:${slot.rechargeFrames}:${slot.definition.maxHp}:${slot.definition.attackDamage}:${slot.definition.moveSpeed}:${slot.definition.standingRange}:${slot.definition.attackMinRange}:${slot.definition.attackMaxRange}:${slot.definition.targetMode}`).join('|');
    const levels = player.supplyLevels.map((level) => `${level.incomePerSecond}:${level.maxSupply}:${level.upgradeCost}`).join('|');
    return `${seatId}:${player.supply}:${player.supplyLevel}:${player.incomeRemainder}:${slots}:${levels}:${cooldowns}`;
  }).join('#');
  const owners = Object.entries(state.ownerBySimulationId)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([simulationId, seatId]) => `${simulationId}:${seatId}`)
    .join('|');
  const rewarded = [...state.rewardedEnemySimulationIds].sort((a, b) => a - b).join(',');
  const rewards = COOP_PLAYABLE_SEATS.map((seatId) => Object.entries(state.enemyRewardSupplyBySeat[seatId])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([enemyId, reward]) => `${enemyId}:${reward}`)
    .join('|')).join('#');
  const baseWeaponSeatState = `${state.baseWeaponLastActivatedSeatId ?? '-'}:${state.baseWeaponPendingSupplySeatId ?? '-'}`;
  return fnv1a([state.shared.stateHash, players, owners, rewarded, rewards, baseWeaponSeatState].join('#'));
}

export function getCoopPlayableSnapshot(state: CoopPlayableBattleState): CoopPlayableSnapshot {
  const battle = state.shared.battle;
  return {
    tick: battle.tick,
    stateHash: state.stateHash,
    winner: battle.winner,
    bases: {
      playerHp: battle.bases.PLAYER.hp,
      playerMaxHp: battle.bases.PLAYER.maxHp,
      enemyHp: battle.bases.ENEMY.hp,
      enemyMaxHp: battle.bases.ENEMY.maxHp,
    },
    baseWeaponId: state.shared.baseWeapon.id ?? null,
    baseWeaponCooldownFrames: getBaseWeaponCooldownRemaining(state.shared),
    baseWeaponLastActivatedSeatId: state.baseWeaponLastActivatedSeatId,
    players: COOP_PLAYABLE_SEATS.map((seatId) => {
      const player = state.players[seatId];
      const nextSupplyLevel = player.supplyLevels[player.supplyLevel];
      return {
        seatId,
        supply: player.supply,
        maxSupply: getCoopCurrentSupplyLevel(state, seatId).maxSupply,
        supplyLevel: player.supplyLevel,
        nextSupplyUpgradeCost: nextSupplyLevel?.upgradeCost ?? null,
        costs: Object.fromEntries(player.slots.map((slot) => [slot.slotId, slot.cost])),
        cooldowns: Object.fromEntries(player.slots.map((slot) => [slot.slotId, getCoopCooldownRemaining(state, seatId, slot.slotId)])),
      };
    }),
    units: battle.units.map((unit) => {
      const ownerSeatId = state.ownerBySimulationId[String(unit.simulationId)];
      return {
        simulationId: unit.simulationId,
        definitionId: unit.definition.id,
        team: unit.team,
        ...(ownerSeatId === undefined ? {} : { ownerSeatId }),
        hp: unit.hp,
        maxHp: unit.definition.maxHp,
        anchorX: unit.anchorX,
        state: unit.state,
      };
    }),
  };
}
