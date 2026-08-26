import {
  DEFAULT_SUPPLY_LEVELS,
  MIN_PLAYER_RECHARGE_FRAMES,
  type EnemyArchetype,
  type PlayerRosterSlot,
  type SupplyLevelDefinition,
} from '@frontline/sim/playable';
import permanentRewardsJson from '../../../content/permanent-rewards/chapter-01.json' with { type: 'json' };

export const REWARD_SCOPES = ['FRONTLINE', 'RANGED', 'AREA'] as const;
export type RewardScope = (typeof REWARD_SCOPES)[number];
export type RewardTargetScope = 'ALL' | RewardScope;

export type PermanentRewardModifier =
  | { readonly kind: 'UNIT_HP_PERCENT'; readonly scope: RewardTargetScope; readonly percent: number }
  | { readonly kind: 'UNIT_ATTACK_PERCENT'; readonly scope: RewardTargetScope; readonly percent: number }
  | { readonly kind: 'STARTING_SUPPLY_PERCENT'; readonly percent: number }
  | { readonly kind: 'PLAYER_BASE_HP_PERCENT'; readonly percent: number }
  | { readonly kind: 'KILL_SUPPLY_PERCENT'; readonly percent: number }
  | { readonly kind: 'WORKER_COST_REDUCTION_PERCENT'; readonly percent: number }
  | { readonly kind: 'RECHARGE_REDUCTION_PERCENT'; readonly percent: number }
  | { readonly kind: 'CHAPTER_FLAG'; readonly flag: string };

export interface PermanentRewardDefinition {
  readonly id: string;
  readonly modifiers: readonly PermanentRewardModifier[];
}

export interface PermanentRewardApplicableSlot extends PlayerRosterSlot {
  readonly rewardScopes: readonly RewardScope[];
}

export interface PermanentRewardBattleInput<TSlot extends PermanentRewardApplicableSlot> {
  readonly ownedRewardIds: readonly string[];
  readonly startingSupply: number;
  readonly playerBaseHp: number;
  /** Stage rule only. Permanent account growth must never modify deployment capacity. */
  readonly playerUnitCap?: number;
  readonly playerSlots: readonly TSlot[];
  readonly enemies: readonly EnemyArchetype[];
  readonly supplyLevels?: readonly SupplyLevelDefinition[];
}

export interface PermanentRewardBattleOutput<TSlot extends PermanentRewardApplicableSlot> {
  readonly startingSupply: number;
  readonly playerBaseHp: number;
  readonly playerUnitCap: number;
  readonly playerSlots: readonly TSlot[];
  readonly enemies: readonly EnemyArchetype[];
  readonly supplyLevels: readonly SupplyLevelDefinition[];
  readonly chapterFlags: readonly string[];
}

const KNOWN_SCOPES = new Set<string>(['ALL', ...REWARD_SCOPES]);
const KNOWN_KINDS = new Set<string>([
  'UNIT_HP_PERCENT',
  'UNIT_ATTACK_PERCENT',
  'STARTING_SUPPLY_PERCENT',
  'PLAYER_BASE_HP_PERCENT',
  'KILL_SUPPLY_PERCENT',
  'WORKER_COST_REDUCTION_PERCENT',
  'RECHARGE_REDUCTION_PERCENT',
  'CHAPTER_FLAG',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requirePercent(value: unknown, context: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100) {
    throw new Error(`${context} must be an integer in 0..100`);
  }
  return value as number;
}

function parseModifier(value: unknown, context: string): PermanentRewardModifier {
  if (!isRecord(value) || typeof value.kind !== 'string' || !KNOWN_KINDS.has(value.kind)) {
    throw new Error(`${context}.kind is unknown: ${String(isRecord(value) ? value.kind : undefined)}`);
  }
  if (value.kind === 'CHAPTER_FLAG') {
    if (typeof value.flag !== 'string' || value.flag.trim().length === 0) throw new Error(`${context}.flag must be a non-empty string`);
    return { kind: 'CHAPTER_FLAG', flag: value.flag };
  }
  if (value.kind === 'UNIT_HP_PERCENT' || value.kind === 'UNIT_ATTACK_PERCENT') {
    if (typeof value.scope !== 'string' || !KNOWN_SCOPES.has(value.scope)) throw new Error(`${context}.scope is unknown: ${String(value.scope)}`);
    return { kind: value.kind, scope: value.scope as RewardTargetScope, percent: requirePercent(value.percent, `${context}.percent`) };
  }
  const percent = requirePercent(value.percent, `${context}.percent`);
  if (value.kind === 'STARTING_SUPPLY_PERCENT') return { kind: value.kind, percent };
  if (value.kind === 'PLAYER_BASE_HP_PERCENT') return { kind: value.kind, percent };
  if (value.kind === 'KILL_SUPPLY_PERCENT') return { kind: value.kind, percent };
  if (value.kind === 'WORKER_COST_REDUCTION_PERCENT') return { kind: value.kind, percent };
  return { kind: 'RECHARGE_REDUCTION_PERCENT', percent };
}

function parseDefinitions(value: unknown): readonly PermanentRewardDefinition[] {
  if (!Array.isArray(value)) throw new Error('permanent rewards must be an array');
  const ids = new Set<string>();
  return value.map((raw, index) => {
    const context = `permanentRewards[${index}]`;
    if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id.trim().length === 0) throw new Error(`${context}.id must be a non-empty string`);
    if (ids.has(raw.id)) throw new Error(`duplicate permanent reward id: ${raw.id}`);
    ids.add(raw.id);
    if (!Array.isArray(raw.modifiers) || raw.modifiers.length === 0) throw new Error(`${context}.modifiers must be non-empty`);
    return { id: raw.id, modifiers: raw.modifiers.map((modifier, modifierIndex) => parseModifier(modifier, `${context}.modifiers[${modifierIndex}]`)) };
  });
}

export const PERMANENT_REWARDS: readonly PermanentRewardDefinition[] = parseDefinitions(permanentRewardsJson);
const REWARD_BY_ID = new Map(PERMANENT_REWARDS.map((reward) => [reward.id, reward] as const));

export function applyPercent(value: number, percent: number, minimum = 1): number {
  return Math.max(minimum, Math.round(value * (100 + percent) / 100));
}

interface AggregatedRewards {
  startingSupplyPercent: number;
  playerBaseHpPercent: number;
  killSupplyPercent: number;
  workerCostReductionPercent: number;
  rechargeReductionPercent: number;
  hpByScope: Map<RewardTargetScope, number>;
  attackByScope: Map<RewardTargetScope, number>;
  chapterFlags: Set<string>;
}

function aggregate(ownedRewardIds: readonly string[]): AggregatedRewards {
  const totals: AggregatedRewards = {
    startingSupplyPercent: 0,
    playerBaseHpPercent: 0,
    killSupplyPercent: 0,
    workerCostReductionPercent: 0,
    rechargeReductionPercent: 0,
    hpByScope: new Map(),
    attackByScope: new Map(),
    chapterFlags: new Set(),
  };
  for (const rewardId of new Set(ownedRewardIds)) {
    const reward = REWARD_BY_ID.get(rewardId);
    if (!reward) continue;
    for (const modifier of reward.modifiers) {
      if (modifier.kind === 'STARTING_SUPPLY_PERCENT') totals.startingSupplyPercent += modifier.percent;
      else if (modifier.kind === 'PLAYER_BASE_HP_PERCENT') totals.playerBaseHpPercent += modifier.percent;
      else if (modifier.kind === 'KILL_SUPPLY_PERCENT') totals.killSupplyPercent += modifier.percent;
      else if (modifier.kind === 'WORKER_COST_REDUCTION_PERCENT') totals.workerCostReductionPercent += modifier.percent;
      else if (modifier.kind === 'RECHARGE_REDUCTION_PERCENT') totals.rechargeReductionPercent += modifier.percent;
      else if (modifier.kind === 'UNIT_HP_PERCENT') totals.hpByScope.set(modifier.scope, (totals.hpByScope.get(modifier.scope) ?? 0) + modifier.percent);
      else if (modifier.kind === 'UNIT_ATTACK_PERCENT') totals.attackByScope.set(modifier.scope, (totals.attackByScope.get(modifier.scope) ?? 0) + modifier.percent);
      else totals.chapterFlags.add(modifier.flag);
    }
  }
  return totals;
}

function eligiblePercent(byScope: ReadonlyMap<RewardTargetScope, number>, scopes: readonly RewardScope[]): number {
  let total = byScope.get('ALL') ?? 0;
  for (const scope of new Set(scopes)) total += byScope.get(scope) ?? 0;
  return total;
}

export function applyPermanentRewardBattleEffects<TSlot extends PermanentRewardApplicableSlot>(input: PermanentRewardBattleInput<TSlot>): PermanentRewardBattleOutput<TSlot> {
  const totals = aggregate(input.ownedRewardIds);
  const playerSlots = input.playerSlots.map((slot) => {
    const hpPercent = eligiblePercent(totals.hpByScope, slot.rewardScopes);
    const attackPercent = eligiblePercent(totals.attackByScope, slot.rewardScopes);
    return {
      ...slot,
      rechargeFrames: Math.max(MIN_PLAYER_RECHARGE_FRAMES, applyPercent(slot.rechargeFrames, -totals.rechargeReductionPercent, MIN_PLAYER_RECHARGE_FRAMES)),
      definition: {
        ...slot.definition,
        maxHp: applyPercent(slot.definition.maxHp, hpPercent),
        attackDamage: applyPercent(slot.definition.attackDamage, attackPercent, 0),
      },
    } as TSlot;
  });
  const enemies = input.enemies.map((enemy) => ({
    ...enemy,
    rewardSupply: applyPercent(enemy.rewardSupply, totals.killSupplyPercent, 0),
    definition: { ...enemy.definition },
  }));
  const supplyLevels = (input.supplyLevels ?? DEFAULT_SUPPLY_LEVELS).map((level, index) => index === 0 ? { ...level } : {
    ...level,
    upgradeCost: applyPercent(level.upgradeCost, -totals.workerCostReductionPercent, 0),
  });
  return {
    startingSupply: applyPercent(input.startingSupply, totals.startingSupplyPercent, 0),
    playerBaseHp: applyPercent(input.playerBaseHp, totals.playerBaseHpPercent),
    playerUnitCap: input.playerUnitCap ?? 50,
    playerSlots,
    enemies,
    supplyLevels,
    chapterFlags: [...totals.chapterFlags].sort(),
  };
}
