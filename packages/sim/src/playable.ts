import {
  SIM_TICK_RATE,
  UnitState,
  applyAreaDamageToTeam,
  applyForcedDisplacementToTeam,
  computeStateHash,
  createBattle,
  getBattleUnitDefinitionSignature,
  spawnUnit,
  stepBattle,
  type BattleState,
  type BattleUnitDefinition,
} from './index.ts';

/** No character, form or account modifier may reduce summon recharge below two seconds. */
export const MIN_PLAYER_RECHARGE_FRAMES = SIM_TICK_RATE * 2;

export interface SupplyLevelDefinition {
  readonly incomePerSecond: number;
  readonly maxSupply: number;
  readonly upgradeCost: number;
}

export const DEFAULT_SUPPLY_LEVELS: readonly SupplyLevelDefinition[] = [
  { incomePerSecond: 12, maxSupply: 1000, upgradeCost: 0 },
  { incomePerSecond: 20, maxSupply: 1400, upgradeCost: 160 },
  { incomePerSecond: 30, maxSupply: 1900, upgradeCost: 260 },
  { incomePerSecond: 42, maxSupply: 2500, upgradeCost: 390 },
  { incomePerSecond: 56, maxSupply: 3200, upgradeCost: 560 },
  { incomePerSecond: 72, maxSupply: 4000, upgradeCost: 760 },
  { incomePerSecond: 90, maxSupply: 5000, upgradeCost: 1000 },
  { incomePerSecond: 110, maxSupply: 6200, upgradeCost: 1300 },
] as const;

export interface BaseWeaponDefinition {
  readonly damage: number;
  readonly cooldownFrames: number;
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

export type SimpleEnemyWaveTrigger =
  | { readonly type: 'TIME'; readonly frame: number }
  | { readonly type: 'ENEMY_BASE_HP_BELOW'; readonly percent: number }
  | { readonly type: 'PLAYER_BASE_HP_BELOW'; readonly percent: number }
  | { readonly type: 'BOSS_HP_BELOW'; readonly enemyId: string; readonly percent: number }
  | { readonly type: 'AFTER_WAVE_TRIGGERED'; readonly waveId: string; readonly delayFrames: number }
  | { readonly type: 'AFTER_WAVE_CLEARED'; readonly waveId: string; readonly delayFrames: number };

export type EnemyWaveTrigger =
  | SimpleEnemyWaveTrigger
  | { readonly type: 'ANY_OF'; readonly conditions: readonly SimpleEnemyWaveTrigger[] };

export interface EnemyWaveSpawnDefinition {
  readonly enemyId: string;
  readonly count: number;
  readonly intervalFrames: number;
  readonly magnificationPermille: number;
}

export interface EnemyWaveRepeatDefinition {
  readonly delayFrames: number;
  readonly maxCycles?: number;
}

export interface EnemyWaveDefinition {
  readonly id: string;
  readonly trigger: EnemyWaveTrigger;
  readonly spawn: EnemyWaveSpawnDefinition;
  readonly repeat?: EnemyWaveRepeatDefinition;
}

interface EnemyWaveRuntime extends EnemyWaveDefinition {
  triggeredTick: number | null;
  clearedTick: number | null;
  spawned: number;
  cycle: number;
  spawnedInCycle: number;
  nextSpawnTick: number;
  readonly spawnedSimulationIds: number[];
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
export type SpawnResult = { readonly ok: true; readonly simulationId: number } | { readonly ok: false; readonly reason: SpawnFailureReason };
export type UpgradeResult = { readonly ok: true; readonly level: number } | { readonly ok: false; readonly reason: UpgradeFailureReason };
export type BaseWeaponResult = { readonly ok: true; readonly readyTick: number } | { readonly ok: false; readonly reason: BaseWeaponFailureReason };

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}
function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
}
function assertPercent(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error(`${name} must be an integer in 1..100`);
}

function validateSupplyLevels(levels: readonly SupplyLevelDefinition[]): void {
  if (levels.length === 0) throw new Error('supplyLevels must not be empty');
  levels.forEach((level, index) => {
    assertNonNegativeInteger(level.incomePerSecond, `supplyLevels[${index}].incomePerSecond`);
    assertPositiveInteger(level.maxSupply, `supplyLevels[${index}].maxSupply`);
    assertNonNegativeInteger(level.upgradeCost, `supplyLevels[${index}].upgradeCost`);
    if (index === 0 && level.upgradeCost !== 0) throw new Error('supplyLevels[0].upgradeCost must be 0');
    if (index > 0) {
      const previous = levels[index - 1]!;
      if (level.maxSupply < previous.maxSupply) throw new Error('supplyLevels maxSupply must not decrease');
      if (level.incomePerSecond < previous.incomePerSecond) throw new Error('supplyLevels incomePerSecond must not decrease');
    }
  });
}

function simpleTriggerReferences(trigger: SimpleEnemyWaveTrigger): readonly string[] {
  return trigger.type === 'AFTER_WAVE_TRIGGERED' || trigger.type === 'AFTER_WAVE_CLEARED' ? [trigger.waveId] : [];
}

function validateSimpleTrigger(trigger: SimpleEnemyWaveTrigger, context: string, enemyIds: ReadonlySet<string>): void {
  if (trigger.type === 'TIME') assertNonNegativeInteger(trigger.frame, `${context}.frame`);
  else if (trigger.type === 'ENEMY_BASE_HP_BELOW' || trigger.type === 'PLAYER_BASE_HP_BELOW') assertPercent(trigger.percent, `${context}.percent`);
  else if (trigger.type === 'BOSS_HP_BELOW') {
    if (!enemyIds.has(trigger.enemyId)) throw new Error(`${context} references unknown boss enemyId: ${trigger.enemyId}`);
    assertPercent(trigger.percent, `${context}.percent`);
  } else {
    if (!trigger.waveId) throw new Error(`${context}.waveId must be non-empty`);
    assertNonNegativeInteger(trigger.delayFrames, `${context}.delayFrames`);
  }
}

function validateConfig(config: PlayableBattleConfig): void {
  assertPositiveInteger(config.mapLength, 'mapLength');
  assertPositiveInteger(config.playerBaseHp, 'playerBaseHp');
  assertPositiveInteger(config.enemyBaseHp, 'enemyBaseHp');
  if (config.startingSupply !== undefined) assertNonNegativeInteger(config.startingSupply, 'startingSupply');
  if (config.playerUnitCap !== undefined) assertPositiveInteger(config.playerUnitCap, 'playerUnitCap');
  if (config.enemyUnitCap !== undefined) assertPositiveInteger(config.enemyUnitCap, 'enemyUnitCap');
  validateSupplyLevels(config.supplyLevels ?? DEFAULT_SUPPLY_LEVELS);

  if (config.playerSlots.length === 0) throw new Error('playerSlots must not be empty');
  const slotIds = new Set<string>();
  for (const slot of config.playerSlots) {
    if (slotIds.has(slot.slotId)) throw new Error(`duplicate slotId: ${slot.slotId}`);
    slotIds.add(slot.slotId);
    assertNonNegativeInteger(slot.cost, 'slot cost');
    assertPositiveInteger(slot.rechargeFrames, 'rechargeFrames');
    if (slot.rechargeFrames < MIN_PLAYER_RECHARGE_FRAMES) throw new Error(`rechargeFrames must be >= ${MIN_PLAYER_RECHARGE_FRAMES}`);
  }

  const enemyIds = new Set<string>();
  for (const enemy of config.enemies) {
    if (enemyIds.has(enemy.enemyId)) throw new Error(`duplicate enemyId: ${enemy.enemyId}`);
    enemyIds.add(enemy.enemyId);
    assertNonNegativeInteger(enemy.rewardSupply, `enemy rewardSupply (${enemy.enemyId})`);
  }
  const waveIds = new Set<string>();
  for (const wave of config.enemyWaves) {
    if (!wave.id || waveIds.has(wave.id)) throw new Error(`enemy wave ids must be unique: ${wave.id}`);
    const simpleTriggers = wave.trigger.type === 'ANY_OF' ? wave.trigger.conditions : [wave.trigger];
    if (wave.trigger.type === 'ANY_OF' && simpleTriggers.length < 2) throw new Error(`${wave.id}.ANY_OF requires at least two conditions`);
    for (const trigger of simpleTriggers) {
      validateSimpleTrigger(trigger, `${wave.id}.trigger`, enemyIds);
      for (const reference of simpleTriggerReferences(trigger)) if (!waveIds.has(reference)) throw new Error(`${wave.id} must reference an earlier wave: ${reference}`);
    }
    if (!enemyIds.has(wave.spawn.enemyId)) throw new Error(`unknown enemyId in wave: ${wave.spawn.enemyId}`);
    assertPositiveInteger(wave.spawn.count, `${wave.id}.spawn.count`);
    assertPositiveInteger(wave.spawn.intervalFrames, `${wave.id}.spawn.intervalFrames`);
    if (!Number.isInteger(wave.spawn.magnificationPermille) || wave.spawn.magnificationPermille < 100 || wave.spawn.magnificationPermille > 10000) throw new Error(`${wave.id}.spawn.magnificationPermille must be in 100..10000`);
    if (wave.repeat) {
      assertPositiveInteger(wave.repeat.delayFrames, `${wave.id}.repeat.delayFrames`);
      if (wave.repeat.maxCycles !== undefined) assertPositiveInteger(wave.repeat.maxCycles, `${wave.id}.repeat.maxCycles`);
    }
    waveIds.add(wave.id);
  }

  const weapon = config.baseWeapon ?? DEFAULT_BASE_WEAPON;
  assertNonNegativeInteger(weapon.damage, 'base weapon damage');
  assertPositiveInteger(weapon.cooldownFrames, 'base weapon cooldownFrames');
  assertNonNegativeInteger(weapon.pushDistance, 'base weapon pushDistance');
  assertPositiveInteger(weapon.pushFrames, 'base weapon pushFrames');
}

export function createPlayableBattle(config: PlayableBattleConfig): PlayableBattleState {
  validateConfig(config);
  const supplyLevels = config.supplyLevels ?? DEFAULT_SUPPLY_LEVELS;
  const startingSupply = config.startingSupply ?? 50;
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
    enemyWaves: config.enemyWaves.map((wave) => ({
      ...wave,
      triggeredTick: null,
      clearedTick: null,
      spawned: 0,
      cycle: 1,
      spawnedInCycle: 0,
      nextSpawnTick: Number.MAX_SAFE_INTEGER,
      spawnedSimulationIds: [],
    })),
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
export function getCurrentSupplyLevel(state: PlayableBattleState): SupplyLevelDefinition { return state.supplyLevels[state.supplyLevel - 1]!; }
export function getNextSupplyLevel(state: PlayableBattleState): SupplyLevelDefinition | null { return state.supplyLevels[state.supplyLevel] ?? null; }
export function getCooldownRemaining(state: PlayableBattleState, slotId: string): number { return Math.max(0, (state.cooldownReadyTick[slotId] ?? 0) - state.battle.tick); }
export function getBaseWeaponCooldownRemaining(state: PlayableBattleState): number { return Math.max(0, state.baseWeaponReadyTick - state.battle.tick); }

export function trySpawnPlayerUnit(state: PlayableBattleState, slotId: string): SpawnResult {
  if (state.battle.winner !== null) return { ok: false, reason: 'battle_over' };
  const slot = state.playerSlots.find((candidate) => candidate.slotId === slotId);
  if (!slot) return { ok: false, reason: 'unknown_slot' };
  if (state.supply < slot.cost) return { ok: false, reason: 'insufficient_supply' };
  if (getCooldownRemaining(state, slotId) > 0) return { ok: false, reason: 'cooldown' };
  if (aliveUnitCount(state, 'PLAYER') >= state.playerUnitCap) return { ok: false, reason: 'unit_cap' };
  const unit = spawnUnit(state.battle, slot.definition, 'PLAYER', Math.min(24, state.battle.mapLength));
  state.supply -= slot.cost;
  state.cooldownReadyTick[slotId] = state.battle.tick + Math.max(MIN_PLAYER_RECHARGE_FRAMES, slot.rechargeFrames);
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

function hpAtOrBelowPercent(hp: number, maxHp: number, percent: number): boolean {
  return hp * 100 <= maxHp * percent;
}

function waveIsFinishedSpawning(wave: EnemyWaveRuntime): boolean {
  const canRepeat = !!wave.repeat && (wave.repeat.maxCycles === undefined || wave.cycle < wave.repeat.maxCycles);
  return wave.triggeredTick !== null && wave.spawnedInCycle >= wave.spawn.count && !canRepeat;
}

function updateWaveClearTicks(state: PlayableBattleState): void {
  const aliveIds = new Set(state.battle.units.filter((unit) => unit.state !== UnitState.Dying).map((unit) => unit.simulationId));
  for (const wave of state.enemyWaves) {
    if (wave.clearedTick !== null || !waveIsFinishedSpawning(wave) || wave.spawnedSimulationIds.length === 0) continue;
    if (wave.spawnedSimulationIds.every((id) => !aliveIds.has(id))) wave.clearedTick = state.battle.tick;
  }
}

function simpleTriggerSatisfied(state: PlayableBattleState, trigger: SimpleEnemyWaveTrigger): boolean {
  if (trigger.type === 'TIME') return state.battle.tick >= trigger.frame;
  if (trigger.type === 'ENEMY_BASE_HP_BELOW') {
    const base = state.battle.bases.ENEMY;
    return hpAtOrBelowPercent(base.hp, base.maxHp, trigger.percent);
  }
  if (trigger.type === 'PLAYER_BASE_HP_BELOW') {
    const base = state.battle.bases.PLAYER;
    return hpAtOrBelowPercent(base.hp, base.maxHp, trigger.percent);
  }
  if (trigger.type === 'BOSS_HP_BELOW') {
    return state.battle.units.some((unit) => unit.team === 'ENEMY' && unit.definition.id === trigger.enemyId && hpAtOrBelowPercent(unit.hp, unit.definition.maxHp, trigger.percent));
  }
  const source = state.enemyWaves.find((wave) => wave.id === trigger.waveId);
  if (!source) return false;
  const anchor = trigger.type === 'AFTER_WAVE_TRIGGERED' ? source.triggeredTick : source.clearedTick;
  return anchor !== null && state.battle.tick >= anchor + trigger.delayFrames;
}

function triggerSatisfied(state: PlayableBattleState, trigger: EnemyWaveTrigger): boolean {
  return trigger.type === 'ANY_OF'
    ? trigger.conditions.some((condition) => simpleTriggerSatisfied(state, condition))
    : simpleTriggerSatisfied(state, trigger);
}

function magnifyDefinition(definition: BattleUnitDefinition, permille: number): BattleUnitDefinition {
  if (permille === 1000) return definition;
  return {
    ...definition,
    maxHp: Math.max(1, Math.round(definition.maxHp * permille / 1000)),
    attackDamage: Math.max(0, Math.round(definition.attackDamage * permille / 1000)),
  };
}

function processEnemyWaves(state: PlayableBattleState): void {
  if (state.battle.winner !== null) return;
  const enemies = new Map(state.enemies.map((enemy) => [enemy.enemyId, enemy]));
  for (const wave of state.enemyWaves) {
    if (wave.triggeredTick === null) {
      if (!triggerSatisfied(state, wave.trigger)) continue;
      wave.triggeredTick = state.battle.tick;
      wave.nextSpawnTick = state.battle.tick;
    }
    if (state.battle.tick < wave.nextSpawnTick || wave.spawnedInCycle >= wave.spawn.count) continue;
    if (aliveUnitCount(state, 'ENEMY') >= state.enemyUnitCap) continue;
    const enemy = enemies.get(wave.spawn.enemyId);
    if (!enemy) continue;
    const unit = spawnUnit(
      state.battle,
      magnifyDefinition(enemy.definition, wave.spawn.magnificationPermille),
      'ENEMY',
      Math.max(0, state.battle.mapLength - 24),
    );
    state.rewardBySimulationId[unit.simulationId] = enemy.rewardSupply;
    wave.spawnedSimulationIds.push(unit.simulationId);
    wave.spawned += 1;
    wave.spawnedInCycle += 1;
    if (wave.spawnedInCycle < wave.spawn.count) {
      wave.nextSpawnTick = state.battle.tick + wave.spawn.intervalFrames;
    } else if (wave.repeat && (wave.repeat.maxCycles === undefined || wave.cycle < wave.repeat.maxCycles)) {
      wave.cycle += 1;
      wave.spawnedInCycle = 0;
      wave.nextSpawnTick = state.battle.tick + wave.repeat.delayFrames;
    } else {
      wave.nextSpawnTick = Number.MAX_SAFE_INTEGER;
    }
  }
}

function processPendingBaseWeapon(state: PlayableBattleState): void {
  if (!state.baseWeaponPending) return;
  state.baseWeaponPending = false;
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
  updateWaveClearTicks(state);
  processEnemyWaves(state);
  const aliveBefore = new Set(state.battle.units.filter((unit) => unit.state !== UnitState.Dying).map((unit) => unit.simulationId));
  processPendingBaseWeapon(state);
  stepBattle(state.battle);
  grantNewDeathRewards(state, aliveBefore);
  updateWaveClearTicks(state);
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

function triggerSignature(trigger: EnemyWaveTrigger): string {
  if (trigger.type === 'ANY_OF') return `ANY_OF(${trigger.conditions.map(triggerSignature).join(',')})`;
  if (trigger.type === 'TIME') return `TIME:${trigger.frame}`;
  if (trigger.type === 'ENEMY_BASE_HP_BELOW' || trigger.type === 'PLAYER_BASE_HP_BELOW') return `${trigger.type}:${trigger.percent}`;
  if (trigger.type === 'BOSS_HP_BELOW') return `${trigger.type}:${trigger.enemyId}:${trigger.percent}`;
  return `${trigger.type}:${trigger.waveId}:${trigger.delayFrames}`;
}

export function computePlayableStateHash(state: PlayableBattleState): string {
  const supplyDefinitions = state.supplyLevels.map((level) => `${level.incomePerSecond}:${level.maxSupply}:${level.upgradeCost}`).join('|');
  const slotDefinitions = [...state.playerSlots].sort((a, b) => a.slotId.localeCompare(b.slotId)).map((slot) => `${slot.slotId}:${slot.cost}:${slot.rechargeFrames}:${getBattleUnitDefinitionSignature(slot.definition)}`).join('|');
  const enemyDefinitions = [...state.enemies].sort((a, b) => a.enemyId.localeCompare(b.enemyId)).map((enemy) => `${enemy.enemyId}:${enemy.rewardSupply}:${getBattleUnitDefinitionSignature(enemy.definition)}`).join('|');
  const cooldowns = Object.entries(state.cooldownReadyTick).sort(([a], [b]) => a.localeCompare(b)).map(([slot, tick]) => `${slot}:${tick}`).join('|');
  const waves = state.enemyWaves.map((wave) => [
    wave.id,
    triggerSignature(wave.trigger),
    wave.spawn.enemyId,
    wave.spawn.count,
    wave.spawn.intervalFrames,
    wave.spawn.magnificationPermille,
    wave.repeat?.delayFrames ?? 0,
    wave.repeat?.maxCycles ?? 0,
    wave.triggeredTick ?? -1,
    wave.clearedTick ?? -1,
    wave.spawned,
    wave.cycle,
    wave.spawnedInCycle,
    wave.nextSpawnTick,
    wave.spawnedSimulationIds.join(','),
  ].join(':')).join('|');
  const rewards = Object.entries(state.rewardBySimulationId).sort(([a], [b]) => Number(a) - Number(b)).map(([id, reward]) => `${id}:${reward}`).join('|');
  const weapon = `${state.baseWeapon.damage}:${state.baseWeapon.cooldownFrames}:${state.baseWeapon.pushDistance}:${state.baseWeapon.pushFrames}:${state.baseWeaponReadyTick}:${state.baseWeaponPending ? 1 : 0}:${state.baseWeaponLastFiredTick}`;
  const caps = `${state.playerUnitCap}:${state.enemyUnitCap}`;
  return fnv1a([computeStateHash(state.battle), state.battle.mapLength, state.supply, state.supplyLevel, state.incomeRemainder, supplyDefinitions, slotDefinitions, enemyDefinitions, cooldowns, waves, rewards, weapon, caps].join('#'));
}
