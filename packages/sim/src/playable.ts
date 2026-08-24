import {
  SIM_TICK_RATE,
  UnitState,
  applyAreaDamageToTeam,
  applyForcedDisplacementToTeam,
  computeStateHash,
  createBattle,
  spawnUnit,
  stepBattle,
  type BattleState,
  type BattleUnitDefinition,
} from './index.ts';

export interface SupplyLevelDefinition {
  readonly incomePerSecond: number;
  readonly maxSupply: number;
  readonly upgradeCost: number;
}

export const DEFAULT_SUPPLY_LEVELS: readonly SupplyLevelDefinition[] = [
  { incomePerSecond: 65, maxSupply: 3000, upgradeCost: 0 },
  { incomePerSecond: 78, maxSupply: 3600, upgradeCost: 350 },
  { incomePerSecond: 92, maxSupply: 4300, upgradeCost: 500 },
  { incomePerSecond: 108, maxSupply: 5100, upgradeCost: 700 },
  { incomePerSecond: 126, maxSupply: 6000, upgradeCost: 950 },
  { incomePerSecond: 146, maxSupply: 7000, upgradeCost: 1250 },
  { incomePerSecond: 168, maxSupply: 8100, upgradeCost: 1600 },
  { incomePerSecond: 192, maxSupply: 9300, upgradeCost: 2050 },
] as const;

export interface BaseWeaponDefinition {
  readonly damage: number;
  readonly cooldownFrames: number;
  /** Backward world-space displacement applied after damage to survivors not already in natural KB. */
  readonly pushDistance: number;
  readonly pushFrames: number;
}

export const DEFAULT_BASE_WEAPON: BaseWeaponDefinition = {
  damage: 90,
  cooldownFrames: 900,
  pushDistance: 60,
  pushFrames: 10,
};

export interface PlayerRosterSlot {
  readonly slotId: string;
  readonly displayName: string;
  readonly definition: BattleUnitDefinition;
  readonly cost: number;
  readonly rechargeFrames: number;
}

export interface EnemyArchetype {
  readonly enemyId: string;
  readonly displayName: string;
  readonly definition: BattleUnitDefinition;
  readonly rewardSupply: number;
}

export interface EnemyWaveDefinition {
  readonly enemyId: string;
  readonly atTick: number;
  readonly count: number;
  readonly intervalTicks: number;
}

interface EnemyWaveRuntime {
  readonly enemyId: string;
  readonly count: number;
  readonly intervalTicks: number;
  spawned: number;
  nextTick: number;
}

export interface PlayableBattleConfig {
  readonly mapLength: number;
  readonly playerBaseHp: number;
  readonly enemyBaseHp: number;
  readonly startingSupply?: number;
  readonly playerUnitCap?: number;
  readonly enemyUnitCap?: number;
  readonly supplyLevels?: readonly SupplyLevelDefinition[];
  readonly baseWeapon?: BaseWeaponDefinition;
  readonly playerSlots: readonly PlayerRosterSlot[];
  readonly enemies: readonly EnemyArchetype[];
  readonly enemyWaves: readonly EnemyWaveDefinition[];
}

export interface PlayableBattleState {
  readonly battle: BattleState;
  supply: number;
  supplyLevel: number;
  incomeRemainder: number;
  readonly supplyLevels: readonly SupplyLevelDefinition[];
  readonly baseWeapon: BaseWeaponDefinition;
  baseWeaponReadyTick: number;
  baseWeaponPending: boolean;
  baseWeaponLastFiredTick: number;
  readonly playerSlots: readonly PlayerRosterSlot[];
  readonly enemies: readonly EnemyArchetype[];
  readonly cooldownReadyTick: Record<string, number>;
  readonly enemyWaves: EnemyWaveRuntime[];
  readonly rewardBySimulationId: Record<number, number>;
  readonly playerUnitCap: number;
  readonly enemyUnitCap: number;
  stateHash: string;
}

export type SpawnFailureReason = 'battle_over' | 'unknown_slot' | 'insufficient_supply' | 'cooldown' | 'unit_cap';
export type UpgradeFailureReason = 'battle_over' | 'max_level' | 'insufficient_supply';
export type BaseWeaponFailureReason = 'battle_over' | 'cooldown' | 'already_pending';

export type SpawnResult =
  | { readonly ok: true; readonly simulationId: number }
  | { readonly ok: false; readonly reason: SpawnFailureReason };

export type UpgradeResult =
  | { readonly ok: true; readonly level: number }
  | { readonly ok: false; readonly reason: UpgradeFailureReason };

export type BaseWeaponResult =
  | { readonly ok: true; readonly readyTick: number }
  | { readonly ok: false; readonly reason: BaseWeaponFailureReason };

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}

function validateConfig(config: PlayableBattleConfig): void {
  assertPositiveInteger(config.mapLength, 'mapLength');
  assertPositiveInteger(config.playerBaseHp, 'playerBaseHp');
  assertPositiveInteger(config.enemyBaseHp, 'enemyBaseHp');
  if (config.playerSlots.length === 0) throw new Error('playerSlots must not be empty');
  const slotIds = new Set<string>();
  for (const slot of config.playerSlots) {
    if (slotIds.has(slot.slotId)) throw new Error(`duplicate slotId: ${slot.slotId}`);
    slotIds.add(slot.slotId);
    if (!Number.isInteger(slot.cost) || slot.cost < 0) throw new Error('slot cost must be a non-negative integer');
    assertPositiveInteger(slot.rechargeFrames, 'rechargeFrames');
  }
  const enemyIds = new Set(config.enemies.map((enemy) => enemy.enemyId));
  if (enemyIds.size !== config.enemies.length) throw new Error('enemyId values must be unique');
  for (const wave of config.enemyWaves) {
    if (!enemyIds.has(wave.enemyId)) throw new Error(`unknown enemyId in wave: ${wave.enemyId}`);
    if (!Number.isInteger(wave.atTick) || wave.atTick < 0) throw new Error('wave atTick must be a non-negative integer');
    assertPositiveInteger(wave.count, 'wave count');
    assertPositiveInteger(wave.intervalTicks, 'wave intervalTicks');
  }
  const weapon = config.baseWeapon ?? DEFAULT_BASE_WEAPON;
  if (!Number.isInteger(weapon.damage) || weapon.damage < 0) throw new Error('base weapon damage must be a non-negative integer');
  assertPositiveInteger(weapon.cooldownFrames, 'base weapon cooldownFrames');
  if (!Number.isInteger(weapon.pushDistance) || weapon.pushDistance < 0) throw new Error('base weapon pushDistance must be a non-negative integer');
  assertPositiveInteger(weapon.pushFrames, 'base weapon pushFrames');
}

export function createPlayableBattle(config: PlayableBattleConfig): PlayableBattleState {
  validateConfig(config);
  const supplyLevels = config.supplyLevels ?? DEFAULT_SUPPLY_LEVELS;
  if (supplyLevels.length === 0) throw new Error('supplyLevels must not be empty');
  const startingSupply = Math.max(0, Math.trunc(config.startingSupply ?? 300));
  const state: PlayableBattleState = {
    battle: createBattle({ mapLength: config.mapLength, playerBaseHp: config.playerBaseHp, enemyBaseHp: config.enemyBaseHp }),
    supply: Math.min(startingSupply, supplyLevels[0]!.maxSupply),
    supplyLevel: 1,
    incomeRemainder: 0,
    supplyLevels,
    baseWeapon: config.baseWeapon ?? DEFAULT_BASE_WEAPON,
    baseWeaponReadyTick: 0,
    baseWeaponPending: false,
    baseWeaponLastFiredTick: -1,
    playerSlots: config.playerSlots,
    enemies: config.enemies,
    cooldownReadyTick: Object.fromEntries(config.playerSlots.map((slot) => [slot.slotId, 0])),
    enemyWaves: config.enemyWaves.map((wave) => ({ ...wave, spawned: 0, nextTick: wave.atTick })),
    rewardBySimulationId: {},
    playerUnitCap: config.playerUnitCap ?? 50,
    enemyUnitCap: config.enemyUnitCap ?? 50,
    stateHash: '',
  };
  state.stateHash = computePlayableStateHash(state);
  return state;
}

function aliveUnitCount(state: PlayableBattleState, team: 'PLAYER' | 'ENEMY'): number {
  return state.battle.units.filter((unit) => unit.team === team && unit.state !== UnitState.Dying).length;
}

export function getCurrentSupplyLevel(state: PlayableBattleState): SupplyLevelDefinition {
  return state.supplyLevels[state.supplyLevel - 1]!;
}

export function getNextSupplyLevel(state: PlayableBattleState): SupplyLevelDefinition | null {
  return state.supplyLevels[state.supplyLevel] ?? null;
}

export function getCooldownRemaining(state: PlayableBattleState, slotId: string): number {
  return Math.max(0, (state.cooldownReadyTick[slotId] ?? 0) - state.battle.tick);
}

export function getBaseWeaponCooldownRemaining(state: PlayableBattleState): number {
  return Math.max(0, state.baseWeaponReadyTick - state.battle.tick);
}

export function trySpawnPlayerUnit(state: PlayableBattleState, slotId: string): SpawnResult {
  if (state.battle.winner !== null) return { ok: false, reason: 'battle_over' };
  const slot = state.playerSlots.find((candidate) => candidate.slotId === slotId);
  if (!slot) return { ok: false, reason: 'unknown_slot' };
  if (state.supply < slot.cost) return { ok: false, reason: 'insufficient_supply' };
  if (getCooldownRemaining(state, slotId) > 0) return { ok: false, reason: 'cooldown' };
  if (aliveUnitCount(state, 'PLAYER') >= state.playerUnitCap) return { ok: false, reason: 'unit_cap' };

  const spawnX = Math.min(24, state.battle.mapLength);
  const unit = spawnUnit(state.battle, slot.definition, 'PLAYER', spawnX);
  state.supply -= slot.cost;
  state.cooldownReadyTick[slotId] = state.battle.tick + slot.rechargeFrames;
  state.stateHash = computePlayableStateHash(state);
  return { ok: true, simulationId: unit.simulationId };
}

export function tryUpgradeSupply(state: PlayableBattleState): UpgradeResult {
  if (state.battle.winner !== null) return { ok: false, reason: 'battle_over' };
  const next = getNextSupplyLevel(state);
  if (!next) return { ok: false, reason: 'max_level' };
  if (state.supply < next.upgradeCost) return { ok: false, reason: 'insufficient_supply' };
  state.supply -= next.upgradeCost;
  state.supplyLevel += 1;
  state.stateHash = computePlayableStateHash(state);
  return { ok: true, level: state.supplyLevel };
}

export function tryFireBaseWeapon(state: PlayableBattleState): BaseWeaponResult {
  if (state.battle.winner !== null) return { ok: false, reason: 'battle_over' };
  if (state.baseWeaponPending) return { ok: false, reason: 'already_pending' };
  if (getBaseWeaponCooldownRemaining(state) > 0) return { ok: false, reason: 'cooldown' };
  state.baseWeaponPending = true;
  state.baseWeaponLastFiredTick = state.battle.tick;
  state.baseWeaponReadyTick = state.battle.tick + state.baseWeapon.cooldownFrames;
  state.stateHash = computePlayableStateHash(state);
  return { ok: true, readyTick: state.baseWeaponReadyTick };
}

function accrueSupply(state: PlayableBattleState): void {
  const level = getCurrentSupplyLevel(state);
  state.incomeRemainder += level.incomePerSecond;
  const gained = Math.trunc(state.incomeRemainder / SIM_TICK_RATE);
  state.incomeRemainder %= SIM_TICK_RATE;
  if (gained > 0) state.supply = Math.min(level.maxSupply, state.supply + gained);
}

function processEnemyWaves(state: PlayableBattleState): void {
  if (state.battle.winner !== null) return;
  const enemies = new Map(state.enemies.map((enemy) => [enemy.enemyId, enemy]));
  for (const wave of state.enemyWaves) {
    if (wave.spawned >= wave.count || state.battle.tick < wave.nextTick) continue;
    if (aliveUnitCount(state, 'ENEMY') >= state.enemyUnitCap) continue;
    const enemy = enemies.get(wave.enemyId);
    if (!enemy) continue;
    const spawnX = Math.max(0, state.battle.mapLength - 24);
    const unit = spawnUnit(state.battle, enemy.definition, 'ENEMY', spawnX);
    state.rewardBySimulationId[unit.simulationId] = enemy.rewardSupply;
    wave.spawned += 1;
    wave.nextTick += wave.intervalTicks;
  }
}

function processPendingBaseWeapon(state: PlayableBattleState): void {
  if (!state.baseWeaponPending) return;
  state.baseWeaponPending = false;
  // Damage first. Targets that die or enter natural KB are no longer eligible for forced movement,
  // preventing a single cannon shot from applying two independent displacement paths to one unit.
  applyAreaDamageToTeam(state.battle, 'ENEMY', state.baseWeapon.damage);
  applyForcedDisplacementToTeam(state.battle, 'ENEMY', state.baseWeapon.pushDistance, state.baseWeapon.pushFrames);
}

function grantNewDeathRewards(state: PlayableBattleState, aliveBefore: ReadonlySet<number>): void {
  const maxSupply = getCurrentSupplyLevel(state).maxSupply;
  for (const unit of state.battle.units) {
    if (!aliveBefore.has(unit.simulationId) || unit.team !== 'ENEMY' || unit.state !== UnitState.Dying) continue;
    const reward = state.rewardBySimulationId[unit.simulationId] ?? 0;
    if (reward > 0) state.supply = Math.min(maxSupply, state.supply + reward);
    delete state.rewardBySimulationId[unit.simulationId];
  }
}

export function stepPlayableBattle(state: PlayableBattleState): PlayableBattleState {
  if (state.battle.winner !== null) return state;
  accrueSupply(state);
  processEnemyWaves(state);
  const aliveBefore = new Set(state.battle.units.filter((unit) => unit.state !== UnitState.Dying).map((unit) => unit.simulationId));
  processPendingBaseWeapon(state);
  stepBattle(state.battle);
  grantNewDeathRewards(state, aliveBefore);
  state.stateHash = computePlayableStateHash(state);
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

export function computePlayableStateHash(state: PlayableBattleState): string {
  const cooldowns = Object.entries(state.cooldownReadyTick).sort(([a], [b]) => a.localeCompare(b)).map(([slot, tick]) => `${slot}:${tick}`).join('|');
  const waves = state.enemyWaves.map((wave) => `${wave.enemyId}:${wave.spawned}:${wave.nextTick}`).join('|');
  const rewards = Object.entries(state.rewardBySimulationId).sort(([a], [b]) => Number(a) - Number(b)).map(([id, reward]) => `${id}:${reward}`).join('|');
  const weapon = `${state.baseWeapon.damage}:${state.baseWeapon.cooldownFrames}:${state.baseWeapon.pushDistance}:${state.baseWeapon.pushFrames}:${state.baseWeaponReadyTick}:${state.baseWeaponPending ? 1 : 0}:${state.baseWeaponLastFiredTick}`;
  return fnv1a([computeStateHash(state.battle), state.supply, state.supplyLevel, state.incomeRemainder, cooldowns, waves, rewards, weapon].join('#'));
}