import type { BattleUnitDefinition } from './index.ts';
import {
  DEFAULT_SUPPLY_LEVELS,
  MIN_PLAYER_RECHARGE_FRAMES,
  type EnemyArchetype,
  type PlayerRosterSlot,
  type SupplyLevelDefinition,
} from './playable.ts';

export interface CharacterLevelAnchor {
  readonly level: number;
  readonly multiplierPermille: number;
}

export interface CharacterLevelCurve {
  readonly id: string;
  readonly status: 'DESIGN_TARGET';
  readonly levelCap: number;
  readonly plusLevelCap: number;
  readonly plusHpAttackPermillePerLevel: number;
  readonly anchors: readonly CharacterLevelAnchor[];
}

export interface EvolutionFormModifiers {
  readonly maxHpPermille: number;
  readonly attackDamagePermille: number;
  readonly costPermille: number;
  readonly rechargePermille: number;
  readonly moveSpeedDelta: number;
  readonly standingRangeDelta: number;
  readonly attackMinRangeDelta: number;
  readonly attackMaxRangeDelta: number;
  readonly targetMode?: BattleUnitDefinition['targetMode'];
  readonly damageBonuses?: BattleUnitDefinition['damageBonuses'];
  readonly naturalKnockbackCount?: number;
  readonly attackTiming?: BattleUnitDefinition['attackTiming'];
}

export interface EvolutionFormDefinition {
  readonly characterId: string;
  readonly formId: string;
  readonly formOrder: 1 | 2 | 3;
  readonly name: string;
  readonly description: string;
  readonly modifiers: EvolutionFormModifiers;
}

export function normalizeCharacterLevel(curve: CharacterLevelCurve, level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(curve.levelCap, Math.trunc(level)));
}

export function normalizeCharacterPlusLevel(curve: CharacterLevelCurve, plusLevel: number): number {
  if (!Number.isFinite(plusLevel)) return 0;
  return Math.max(0, Math.min(curve.plusLevelCap, Math.trunc(plusLevel)));
}

export function getCharacterLevelMultiplierPermille(curve: CharacterLevelCurve, level: number): number {
  const normalized = normalizeCharacterLevel(curve, level);
  const anchors = curve.anchors;
  const exact = anchors.find((anchor) => anchor.level === normalized);
  if (exact) return exact.multiplierPermille;
  for (let index = 1; index < anchors.length; index += 1) {
    const right = anchors[index]!;
    const left = anchors[index - 1]!;
    if (normalized < right.level) {
      const numerator = (right.multiplierPermille - left.multiplierPermille) * (normalized - left.level);
      return left.multiplierPermille + numerator / (right.level - left.level);
    }
  }
  return anchors[anchors.length - 1]!.multiplierPermille;
}

export function getCharacterTotalMultiplierPermille(curve: CharacterLevelCurve, level: number, plusLevel = 0): number {
  const baseMultiplierPermille = getCharacterLevelMultiplierPermille(curve, level);
  const plusMultiplierPermille = 1000
    + normalizeCharacterPlusLevel(curve, plusLevel) * curve.plusHpAttackPermillePerLevel;
  return (baseMultiplierPermille * plusMultiplierPermille) / 1000;
}

function scale(value: number, permille: number, minimum = 0): number {
  return Math.max(minimum, Math.trunc((value * permille) / 1000));
}

function scaleFinalStat(value: number, permille: number, minimum = 0): number {
  return Math.max(minimum, Math.round((value * permille) / 1000));
}

export function applyCharacterLevel(
  slot: PlayerRosterSlot,
  curve: CharacterLevelCurve,
  level: number,
  plusLevel = 0,
): PlayerRosterSlot {
  const multiplier = getCharacterTotalMultiplierPermille(curve, level, plusLevel);
  return {
    ...slot,
    definition: {
      ...slot.definition,
      maxHp: scaleFinalStat(slot.definition.maxHp, multiplier, 1),
      attackDamage: scaleFinalStat(slot.definition.attackDamage, multiplier, 0),
    },
  };
}

export function getEvolutionForm(forms: readonly EvolutionFormDefinition[], formId: string): EvolutionFormDefinition {
  const form = forms.find((candidate) => candidate.formId === formId);
  if (!form) throw new Error(`Unknown evolution form: ${formId}`);
  return form;
}

export function applyEvolutionForm(
  slot: PlayerRosterSlot,
  forms: readonly EvolutionFormDefinition[],
  formId: string,
): PlayerRosterSlot {
  const form = getEvolutionForm(forms, formId);
  if (form.characterId !== slot.slotId) throw new Error(`Evolution form ${formId} does not belong to ${slot.slotId}`);
  const modifiers = form.modifiers;
  const standingRange = slot.definition.standingRange + modifiers.standingRangeDelta;
  const attackMinRange = slot.definition.attackMinRange + modifiers.attackMinRangeDelta;
  const attackMaxRange = slot.definition.attackMaxRange + modifiers.attackMaxRangeDelta;
  const moveSpeed = slot.definition.moveSpeed + modifiers.moveSpeedDelta;
  if (standingRange < 0 || attackMinRange < 0 || attackMaxRange < 0 || attackMinRange > attackMaxRange) {
    throw new Error(`Evolution form produces invalid ranges: ${formId}`);
  }
  if (moveSpeed < 0) throw new Error(`Evolution form produces negative move speed: ${formId}`);
  return {
    ...slot,
    cost: scale(slot.cost, modifiers.costPermille, 0),
    rechargeFrames: Math.max(MIN_PLAYER_RECHARGE_FRAMES, scale(slot.rechargeFrames, modifiers.rechargePermille, 1)),
    definition: {
      ...slot.definition,
      maxHp: scale(slot.definition.maxHp, modifiers.maxHpPermille, 1),
      attackDamage: scale(slot.definition.attackDamage, modifiers.attackDamagePermille, 0),
      moveSpeed,
      standingRange,
      attackMinRange,
      attackMaxRange,
      targetMode: modifiers.targetMode ?? slot.definition.targetMode,
      naturalKnockbackCount: modifiers.naturalKnockbackCount ?? slot.definition.naturalKnockbackCount,
      attackTiming: modifiers.attackTiming ?? slot.definition.attackTiming,
      ...(modifiers.damageBonuses === undefined ? {} : { damageBonuses: modifiers.damageBonuses }),
    },
  };
}

export function buildCharacterCombatSlot(
  slot: PlayerRosterSlot,
  curve: CharacterLevelCurve,
  forms: readonly EvolutionFormDefinition[],
  level: number,
  formId?: string,
  plusLevel = 0,
): PlayerRosterSlot {
  const leveled = applyCharacterLevel(slot, curve, level, plusLevel);
  return formId ? applyEvolutionForm(leveled, forms, formId) : leveled;
}

export const PERMANENT_REWARD_SCOPES = ['FRONTLINE', 'RANGED', 'AREA'] as const;
export type PermanentRewardScope = (typeof PERMANENT_REWARD_SCOPES)[number];
export type PermanentRewardTargetScope = 'ALL' | PermanentRewardScope;

export type PermanentRewardModifier =
  | { readonly kind: 'UNIT_HP_PERCENT'; readonly scope: PermanentRewardTargetScope; readonly percent: number }
  | { readonly kind: 'UNIT_ATTACK_PERCENT'; readonly scope: PermanentRewardTargetScope; readonly percent: number }
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
  readonly rewardScopes: readonly PermanentRewardScope[];
}

export interface PermanentRewardBattleInput<TSlot extends PermanentRewardApplicableSlot> {
  readonly ownedRewardIds: readonly string[];
  readonly startingSupply: number;
  readonly playerBaseHp: number;
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

export function applyPercent(value: number, percent: number, minimum = 1): number {
  return Math.max(minimum, Math.round(value * (100 + percent) / 100));
}

interface AggregatedRewards {
  startingSupplyPercent: number;
  playerBaseHpPercent: number;
  killSupplyPercent: number;
  workerCostReductionPercent: number;
  rechargeReductionPercent: number;
  hpByScope: Map<PermanentRewardTargetScope, number>;
  attackByScope: Map<PermanentRewardTargetScope, number>;
  chapterFlags: Set<string>;
}

function aggregatePermanentRewards(
  ownedRewardIds: readonly string[],
  definitions: readonly PermanentRewardDefinition[],
): AggregatedRewards {
  const rewardById = new Map(definitions.map((reward) => [reward.id, reward] as const));
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
    const reward = rewardById.get(rewardId);
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

function eligiblePercent(byScope: ReadonlyMap<PermanentRewardTargetScope, number>, scopes: readonly PermanentRewardScope[]): number {
  let total = byScope.get('ALL') ?? 0;
  for (const scope of new Set(scopes)) total += byScope.get(scope) ?? 0;
  return total;
}

export function applyPermanentRewardBattleEffects<TSlot extends PermanentRewardApplicableSlot>(
  input: PermanentRewardBattleInput<TSlot>,
  definitions: readonly PermanentRewardDefinition[],
): PermanentRewardBattleOutput<TSlot> {
  const totals = aggregatePermanentRewards(input.ownedRewardIds, definitions);
  const playerSlots = input.playerSlots.map((slot) => {
    const hpPercent = eligiblePercent(totals.hpByScope, slot.rewardScopes);
    const attackPercent = eligiblePercent(totals.attackByScope, slot.rewardScopes);
    return {
      ...slot,
      rechargeFrames: Math.max(
        MIN_PLAYER_RECHARGE_FRAMES,
        applyPercent(slot.rechargeFrames, -totals.rechargeReductionPercent, MIN_PLAYER_RECHARGE_FRAMES),
      ),
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
