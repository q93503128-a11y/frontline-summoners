import type { Attribute, CombatTag } from '@frontline/content-schema';
import { ATTRIBUTES, COMBAT_TAGS } from '@frontline/content-schema';
import {
  DEFAULT_SUPPLY_LEVELS,
  MIN_PLAYER_RECHARGE_FRAMES,
  type EnemyArchetype,
  type PlayerRosterSlot,
  type SupplyLevelDefinition,
} from '@frontline/sim/playable';
import treasureEffectsJson from '../../../content/treasures/chapter-01.json' with { type: 'json' };

export type TreasureUnitStat = 'maxHp' | 'attackDamage' | 'range' | 'rechargeFrames';

export interface TreasureUnitSelector {
  readonly slotId?: string;
  readonly role?: string;
  readonly attribute?: Attribute;
  readonly combatTag?: CombatTag;
  readonly costAtMost?: number;
  readonly attackMinRangeEquals?: number;
  readonly attackMinRangeAtLeast?: number;
}

export type TreasureUnitModifier =
  | { readonly kind: 'UNIT_STAT_PERCENT'; readonly stat: TreasureUnitStat; readonly percent: number; readonly selector: TreasureUnitSelector }
  | { readonly kind: 'UNIT_STAT_FLAT'; readonly stat: TreasureUnitStat; readonly amount: number; readonly selector: TreasureUnitSelector };

export type TreasureModifier =
  | { readonly kind: 'STARTING_SUPPLY_PERCENT'; readonly percent: number }
  | { readonly kind: 'PLAYER_BASE_HP_PERCENT'; readonly percent: number }
  | { readonly kind: 'SUPPLY_UPGRADE_COST_PERCENT'; readonly percent: number }
  | { readonly kind: 'ENEMY_REWARD_PERCENT'; readonly percent: number }
  | TreasureUnitModifier
  | { readonly kind: 'CHAPTER_FLAG'; readonly flag: string };

export interface TreasureEffectDefinition {
  readonly id: string;
  readonly modifiers: readonly TreasureModifier[];
}
export interface TreasureApplicableSlot extends PlayerRosterSlot { readonly role: string; }
export interface TreasureBattleInput<TSlot extends TreasureApplicableSlot> {
  readonly ownedTreasureIds: readonly string[];
  readonly startingSupply: number;
  readonly playerBaseHp: number;
  /** Kept as a stage rule, never modified by permanent treasure growth. */
  readonly playerUnitCap?: number;
  readonly playerSlots: readonly TSlot[];
  readonly enemies: readonly EnemyArchetype[];
  readonly supplyLevels?: readonly SupplyLevelDefinition[];
}
export interface TreasureBattleOutput<TSlot extends TreasureApplicableSlot> {
  readonly startingSupply: number;
  readonly playerBaseHp: number;
  readonly playerUnitCap: number;
  readonly playerSlots: readonly TSlot[];
  readonly enemies: readonly EnemyArchetype[];
  readonly supplyLevels: readonly SupplyLevelDefinition[];
  readonly chapterFlags: readonly string[];
}

const KNOWN_ATTRIBUTES = new Set<Attribute>(ATTRIBUTES);
const KNOWN_TAGS = new Set<CombatTag>(COMBAT_TAGS);
const UNIT_STATS = new Set<TreasureUnitStat>(['maxHp', 'attackDamage', 'range', 'rechargeFrames']);
const PERCENT_KINDS = new Set(['STARTING_SUPPLY_PERCENT', 'PLAYER_BASE_HP_PERCENT', 'SUPPLY_UPGRADE_COST_PERCENT', 'ENEMY_REWARD_PERCENT']);

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function requireInteger(value: unknown, context: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`${context} must be an integer in ${min}..${max}`);
  return value as number;
}

function parseSelector(value: unknown, context: string): TreasureUnitSelector {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const selector: { slotId?: string; role?: string; attribute?: Attribute; combatTag?: CombatTag; costAtMost?: number; attackMinRangeEquals?: number; attackMinRangeAtLeast?: number } = {};
  if (value.slotId !== undefined) {
    if (typeof value.slotId !== 'string' || value.slotId.length === 0) throw new Error(`${context}.slotId must be a string`);
    selector.slotId = value.slotId;
  }
  if (value.role !== undefined) {
    if (typeof value.role !== 'string' || value.role.length === 0) throw new Error(`${context}.role must be a string`);
    selector.role = value.role;
  }
  if (value.attribute !== undefined) {
    if (typeof value.attribute !== 'string' || !KNOWN_ATTRIBUTES.has(value.attribute as Attribute)) throw new Error(`${context}.attribute is unknown`);
    selector.attribute = value.attribute as Attribute;
  }
  if (value.combatTag !== undefined) {
    if (typeof value.combatTag !== 'string' || !KNOWN_TAGS.has(value.combatTag as CombatTag)) throw new Error(`${context}.combatTag is unknown`);
    selector.combatTag = value.combatTag as CombatTag;
  }
  if (value.costAtMost !== undefined) selector.costAtMost = requireInteger(value.costAtMost, `${context}.costAtMost`, 0, 1000000);
  if (value.attackMinRangeEquals !== undefined) selector.attackMinRangeEquals = requireInteger(value.attackMinRangeEquals, `${context}.attackMinRangeEquals`, 0, 10000);
  if (value.attackMinRangeAtLeast !== undefined) selector.attackMinRangeAtLeast = requireInteger(value.attackMinRangeAtLeast, `${context}.attackMinRangeAtLeast`, 0, 10000);
  return selector;
}

function parseModifier(value: unknown, context: string): TreasureModifier {
  if (!isRecord(value) || typeof value.kind !== 'string') throw new Error(`${context}.kind is required`);
  if (PERCENT_KINDS.has(value.kind)) {
    const percent = requireInteger(value.percent, `${context}.percent`, -90, 500);
    if (value.kind === 'STARTING_SUPPLY_PERCENT') return { kind: value.kind, percent };
    if (value.kind === 'PLAYER_BASE_HP_PERCENT') return { kind: value.kind, percent };
    if (value.kind === 'SUPPLY_UPGRADE_COST_PERCENT') return { kind: value.kind, percent };
    return { kind: 'ENEMY_REWARD_PERCENT', percent };
  }
  if (value.kind === 'CHAPTER_FLAG') {
    if (typeof value.flag !== 'string' || value.flag.length === 0) throw new Error(`${context}.flag must be a string`);
    return { kind: value.kind, flag: value.flag };
  }
  if (value.kind === 'UNIT_STAT_PERCENT' || value.kind === 'UNIT_STAT_FLAT') {
    if (typeof value.stat !== 'string' || !UNIT_STATS.has(value.stat as TreasureUnitStat)) throw new Error(`${context}.stat is unknown`);
    const stat = value.stat as TreasureUnitStat;
    const selector = parseSelector(value.selector, `${context}.selector`);
    return value.kind === 'UNIT_STAT_PERCENT'
      ? { kind: value.kind, stat, percent: requireInteger(value.percent, `${context}.percent`, -90, 500), selector }
      : { kind: value.kind, stat, amount: requireInteger(value.amount, `${context}.amount`, -100000, 100000), selector };
  }
  throw new Error(`${context}.kind is unknown: ${value.kind}`);
}

function parseDefinitions(value: unknown): readonly TreasureEffectDefinition[] {
  if (!Array.isArray(value)) throw new Error('treasure effects must be an array');
  const ids = new Set<string>();
  return value.map((raw, index) => {
    const context = `treasureEffects[${index}]`;
    if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id.length === 0) throw new Error(`${context}.id must be a string`);
    if (ids.has(raw.id)) throw new Error(`duplicate treasure effect id: ${raw.id}`);
    ids.add(raw.id);
    if (!Array.isArray(raw.modifiers) || raw.modifiers.length === 0) throw new Error(`${context}.modifiers must be non-empty`);
    return { id: raw.id, modifiers: raw.modifiers.map((modifier, modifierIndex) => parseModifier(modifier, `${context}.modifiers[${modifierIndex}]`)) };
  });
}

export const TREASURE_EFFECTS: readonly TreasureEffectDefinition[] = parseDefinitions(treasureEffectsJson);
const EFFECT_BY_ID = new Map(TREASURE_EFFECTS.map((effect) => [effect.id, effect] as const));

export function applyIntegerPercent(value: number, percent: number, minimum = 1): number {
  if (percent === 0 || value === 0) return value;
  const scaled = Math.round((value * (100 + percent)) / 100);
  if (percent > 0) return Math.max(value + 1, scaled);
  return Math.max(minimum, Math.min(value - 1, scaled));
}

function selectorMatches(slot: TreasureApplicableSlot, selector: TreasureUnitSelector): boolean {
  if (selector.slotId !== undefined && slot.slotId !== selector.slotId) return false;
  if (selector.role !== undefined && slot.role !== selector.role) return false;
  if (selector.attribute !== undefined && !(slot.definition.attributes ?? []).includes(selector.attribute)) return false;
  if (selector.combatTag !== undefined && !(slot.definition.combatTags ?? []).includes(selector.combatTag)) return false;
  if (selector.costAtMost !== undefined && slot.cost > selector.costAtMost) return false;
  if (selector.attackMinRangeEquals !== undefined && slot.definition.attackMinRange !== selector.attackMinRangeEquals) return false;
  if (selector.attackMinRangeAtLeast !== undefined && slot.definition.attackMinRange < selector.attackMinRangeAtLeast) return false;
  return true;
}

function modifyInteger(value: number, modifier: TreasureUnitModifier, minimum: number): number {
  return modifier.kind === 'UNIT_STAT_PERCENT' ? applyIntegerPercent(value, modifier.percent, minimum) : Math.max(minimum, value + modifier.amount);
}

function modifySlot<TSlot extends TreasureApplicableSlot>(slot: TSlot, modifier: TreasureUnitModifier): TSlot {
  if (!selectorMatches(slot, modifier.selector)) return slot;
  if (modifier.stat === 'rechargeFrames') {
    return { ...slot, rechargeFrames: Math.max(MIN_PLAYER_RECHARGE_FRAMES, modifyInteger(slot.rechargeFrames, modifier, MIN_PLAYER_RECHARGE_FRAMES)) } as TSlot;
  }
  const definition = { ...slot.definition };
  if (modifier.stat === 'range') {
    definition.standingRange = modifyInteger(definition.standingRange, modifier, 0);
    definition.attackMinRange = definition.attackMinRange === 0 ? 0 : modifyInteger(definition.attackMinRange, modifier, 0);
    definition.attackMaxRange = modifyInteger(definition.attackMaxRange, modifier, 0);
  } else if (modifier.stat === 'maxHp') definition.maxHp = modifyInteger(definition.maxHp, modifier, 1);
  else definition.attackDamage = modifyInteger(definition.attackDamage, modifier, 0);
  return { ...slot, definition } as TSlot;
}

export function applyTreasureBattleEffects<TSlot extends TreasureApplicableSlot>(input: TreasureBattleInput<TSlot>): TreasureBattleOutput<TSlot> {
  const owned = new Set(input.ownedTreasureIds);
  let startingSupply = input.startingSupply;
  let playerBaseHp = input.playerBaseHp;
  const playerUnitCap = input.playerUnitCap ?? 50;
  let playerSlots = input.playerSlots.map((slot) => ({ ...slot, definition: { ...slot.definition } }) as TSlot);
  let enemies = input.enemies.map((enemy) => ({ ...enemy, definition: { ...enemy.definition } }));
  let supplyLevels = (input.supplyLevels ?? DEFAULT_SUPPLY_LEVELS).map((level) => ({ ...level }));
  const chapterFlags = new Set<string>();
  for (const treasureId of owned) {
    const effect = EFFECT_BY_ID.get(treasureId);
    if (!effect) continue;
    for (const modifier of effect.modifiers) {
      if (modifier.kind === 'STARTING_SUPPLY_PERCENT') startingSupply = applyIntegerPercent(startingSupply, modifier.percent, 0);
      else if (modifier.kind === 'PLAYER_BASE_HP_PERCENT') playerBaseHp = applyIntegerPercent(playerBaseHp, modifier.percent);
      else if (modifier.kind === 'SUPPLY_UPGRADE_COST_PERCENT') supplyLevels = supplyLevels.map((level, index) => index === 0 ? level : { ...level, upgradeCost: applyIntegerPercent(level.upgradeCost, modifier.percent, 0) });
      else if (modifier.kind === 'ENEMY_REWARD_PERCENT') enemies = enemies.map((enemy) => ({ ...enemy, rewardSupply: applyIntegerPercent(enemy.rewardSupply, modifier.percent, 0) }));
      else if (modifier.kind === 'UNIT_STAT_PERCENT' || modifier.kind === 'UNIT_STAT_FLAT') playerSlots = playerSlots.map((slot) => modifySlot(slot, modifier));
      else chapterFlags.add(modifier.flag);
    }
  }
  return { startingSupply, playerBaseHp, playerUnitCap, playerSlots, enemies, supplyLevels, chapterFlags: [...chapterFlags].sort() };
}
