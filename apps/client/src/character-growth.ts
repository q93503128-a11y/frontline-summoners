import {
  ATTRIBUTES,
  COMBAT_TAGS,
  DAMAGE_BONUS_TARGET_KINDS,
  TARGET_MODES,
  type DamageBonusContent,
  type TargetMode,
} from '@frontline/content-schema';
import { MIN_PLAYER_RECHARGE_FRAMES, type PlayerRosterSlot } from '@frontline/sim/playable';
import levelCurveJson from '../../../content/growth/level-curve-01.json' with { type: 'json' };
import evolutionJson from '../../../content/evolution/recruitment-01.json' with { type: 'json' };
import { ALL_PLAYER_SLOTS } from './prototype.ts';

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
  readonly targetMode?: TargetMode;
  readonly damageBonuses?: readonly DamageBonusContent[];
}

export interface EvolutionFormDefinition {
  readonly characterId: string;
  readonly formId: string;
  readonly formOrder: 1 | 2 | 3;
  readonly name: string;
  readonly description: string;
  readonly modifiers: EvolutionFormModifiers;
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
}
function nonEmptyString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${context} must be a non-empty string`);
  return value;
}
function integer(value: unknown, context: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`${context} must be an integer in ${min}..${max}`);
  return value as number;
}
function signedInteger(value: unknown, context: string, fallback = 0): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value)) throw new Error(`${context} must be an integer`);
  return value as number;
}

function parseLevelCurve(value: unknown): CharacterLevelCurve {
  const raw = record(value, 'level curve');
  if (raw.status !== 'DESIGN_TARGET') throw new Error('level curve status must be DESIGN_TARGET');
  const levelCap = integer(raw.levelCap, 'levelCap', 1, 100);
  const plusLevelCap = integer(raw.plusLevelCap, 'plusLevelCap', 0, 200);
  if (!Array.isArray(raw.anchors) || raw.anchors.length < 2) throw new Error('level curve anchors must contain at least two entries');
  const anchors = raw.anchors.map((value, index) => {
    const item = record(value, `anchors[${index}]`);
    return {
      level: integer(item.level, `anchors[${index}].level`, 1, levelCap),
      multiplierPermille: integer(item.multiplierPermille, `anchors[${index}].multiplierPermille`, 1, 100000),
    };
  });
  if (anchors[0]!.level !== 1 || anchors[anchors.length - 1]!.level !== levelCap) throw new Error('level curve anchors must start at 1 and end at levelCap');
  for (let index = 1; index < anchors.length; index += 1) {
    if (anchors[index]!.level <= anchors[index - 1]!.level) throw new Error('level curve anchor levels must strictly increase');
    if (anchors[index]!.multiplierPermille < anchors[index - 1]!.multiplierPermille) throw new Error('level curve multipliers must not decrease');
  }
  return {
    id: nonEmptyString(raw.id, 'level curve id'),
    status: 'DESIGN_TARGET',
    levelCap,
    plusLevelCap,
    plusHpAttackPermillePerLevel: integer(raw.plusHpAttackPermillePerLevel, 'plus growth', 0, 5000),
    anchors,
  };
}

export const CHARACTER_LEVEL_CURVE = parseLevelCurve(levelCurveJson);

function parseDamageBonuses(value: unknown, context: string): readonly DamageBonusContent[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  const bonuses = value.map((item, index): DamageBonusContent => {
    const raw = record(item, `${context}[${index}]`);
    const targetKind = nonEmptyString(raw.targetKind, `${context}[${index}].targetKind`);
    if (!(DAMAGE_BONUS_TARGET_KINDS as readonly string[]).includes(targetKind)) throw new Error(`${context}[${index}].targetKind is unknown`);
    const target = nonEmptyString(raw.target, `${context}[${index}].target`);
    const multiplierPermille = integer(raw.multiplierPermille, `${context}[${index}].multiplierPermille`, 1000, 3000);
    if (targetKind === 'ATTRIBUTE') {
      if (!(ATTRIBUTES as readonly string[]).includes(target)) throw new Error(`${context}[${index}].target attribute is unknown`);
      return { targetKind, target: target as (typeof ATTRIBUTES)[number], multiplierPermille };
    }
    if (!(COMBAT_TAGS as readonly string[]).includes(target)) throw new Error(`${context}[${index}].target tag is unknown`);
    return { targetKind: 'TAG', target: target as (typeof COMBAT_TAGS)[number], multiplierPermille };
  });
  const keys = bonuses.map((bonus) => `${bonus.targetKind}:${bonus.target}`);
  if (new Set(keys).size !== keys.length) throw new Error(`${context} targets must be unique`);
  return bonuses;
}

function parseModifiers(value: unknown, context: string): EvolutionFormModifiers {
  const raw = record(value, context);
  const targetModeRaw = raw.targetMode;
  let targetMode: TargetMode | undefined;
  if (targetModeRaw !== undefined) {
    if (typeof targetModeRaw !== 'string' || !(TARGET_MODES as readonly string[]).includes(targetModeRaw)) throw new Error(`${context}.targetMode is unknown`);
    targetMode = targetModeRaw as TargetMode;
  }
  const damageBonuses = parseDamageBonuses(raw.damageBonuses, `${context}.damageBonuses`);
  return {
    maxHpPermille: raw.maxHpPermille === undefined ? 1000 : integer(raw.maxHpPermille, `${context}.maxHpPermille`, 1, 5000),
    attackDamagePermille: raw.attackDamagePermille === undefined ? 1000 : integer(raw.attackDamagePermille, `${context}.attackDamagePermille`, 0, 5000),
    costPermille: raw.costPermille === undefined ? 1000 : integer(raw.costPermille, `${context}.costPermille`, 0, 5000),
    rechargePermille: raw.rechargePermille === undefined ? 1000 : integer(raw.rechargePermille, `${context}.rechargePermille`, 1, 5000),
    moveSpeedDelta: signedInteger(raw.moveSpeedDelta, `${context}.moveSpeedDelta`),
    standingRangeDelta: signedInteger(raw.standingRangeDelta, `${context}.standingRangeDelta`),
    attackMinRangeDelta: signedInteger(raw.attackMinRangeDelta, `${context}.attackMinRangeDelta`),
    attackMaxRangeDelta: signedInteger(raw.attackMaxRangeDelta, `${context}.attackMaxRangeDelta`),
    ...(targetMode === undefined ? {} : { targetMode }),
    ...(damageBonuses === undefined ? {} : { damageBonuses }),
  };
}

function buildEvolutionForms(): readonly EvolutionFormDefinition[] {
  if (!Array.isArray(evolutionJson)) throw new Error('evolution content must be an array');
  const knownCharacters = new Set(ALL_PLAYER_SLOTS.map((slot) => slot.slotId));
  const characterIds = new Set<string>();
  const formIds = new Set<string>();
  const result: EvolutionFormDefinition[] = [];
  evolutionJson.forEach((entry, entryIndex) => {
    const raw = record(entry, `evolution[${entryIndex}]`);
    const characterId = nonEmptyString(raw.characterId, `evolution[${entryIndex}].characterId`);
    if (!knownCharacters.has(characterId)) throw new Error(`evolution references unknown character: ${characterId}`);
    if (characterIds.has(characterId)) throw new Error(`duplicate evolution character: ${characterId}`);
    characterIds.add(characterId);
    if (!Array.isArray(raw.forms) || raw.forms.length !== 3) throw new Error(`${characterId} must define exactly three forms`);
    raw.forms.forEach((formValue, formIndex) => {
      const form = record(formValue, `${characterId}.forms[${formIndex}]`);
      const formId = nonEmptyString(form.formId, `${characterId}.forms[${formIndex}].formId`);
      if (formIds.has(formId)) throw new Error(`duplicate evolution form id: ${formId}`);
      formIds.add(formId);
      const formOrder = integer(form.formOrder, `${formId}.formOrder`, 1, 3) as 1 | 2 | 3;
      if (formOrder !== formIndex + 1) throw new Error(`${characterId} forms must be ordered 1,2,3`);
      result.push({ characterId, formId, formOrder, name: nonEmptyString(form.name, `${formId}.name`), description: nonEmptyString(form.description, `${formId}.description`), modifiers: parseModifiers(form.modifiers ?? {}, `${formId}.modifiers`) });
    });
  });
  return result;
}

export const EVOLUTION_FORMS: readonly EvolutionFormDefinition[] = buildEvolutionForms();

export function normalizeCharacterLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(CHARACTER_LEVEL_CURVE.levelCap, Math.trunc(level)));
}
export function normalizeCharacterPlusLevel(plusLevel: number): number {
  if (!Number.isFinite(plusLevel)) return 0;
  return Math.max(0, Math.min(CHARACTER_LEVEL_CURVE.plusLevelCap, Math.trunc(plusLevel)));
}

export function getCharacterLevelMultiplierPermille(level: number): number {
  const normalized = normalizeCharacterLevel(level);
  const anchors = CHARACTER_LEVEL_CURVE.anchors;
  const exact = anchors.find((anchor) => anchor.level === normalized);
  if (exact) return exact.multiplierPermille;
  for (let index = 1; index < anchors.length; index += 1) {
    const right = anchors[index]!;
    const left = anchors[index - 1]!;
    if (normalized < right.level) {
      const numerator = (right.multiplierPermille - left.multiplierPermille) * (normalized - left.level);
      return left.multiplierPermille + Math.trunc(numerator / (right.level - left.level));
    }
  }
  return anchors[anchors.length - 1]!.multiplierPermille;
}

export function getCharacterTotalMultiplierPermille(level: number, plusLevel = 0): number {
  return getCharacterLevelMultiplierPermille(level)
    + normalizeCharacterPlusLevel(plusLevel) * CHARACTER_LEVEL_CURVE.plusHpAttackPermillePerLevel;
}

function scale(value: number, permille: number, minimum = 0): number {
  return Math.max(minimum, Math.trunc((value * permille) / 1000));
}

export function applyCharacterLevel(slot: PlayerRosterSlot, level: number, plusLevel = 0): PlayerRosterSlot {
  const multiplier = getCharacterTotalMultiplierPermille(level, plusLevel);
  return { ...slot, definition: { ...slot.definition, maxHp: scale(slot.definition.maxHp, multiplier, 1), attackDamage: scale(slot.definition.attackDamage, multiplier, 0) } };
}

export function getEvolutionForms(characterId: string): readonly EvolutionFormDefinition[] {
  return EVOLUTION_FORMS.filter((form) => form.characterId === characterId);
}
export function getEvolutionForm(formId: string): EvolutionFormDefinition {
  const form = EVOLUTION_FORMS.find((candidate) => candidate.formId === formId);
  if (!form) throw new Error(`Unknown evolution form: ${formId}`);
  return form;
}

export function applyEvolutionForm(slot: PlayerRosterSlot, formId: string): PlayerRosterSlot {
  const form = getEvolutionForm(formId);
  if (form.characterId !== slot.slotId) throw new Error(`Evolution form ${formId} does not belong to ${slot.slotId}`);
  const modifiers = form.modifiers;
  const standingRange = slot.definition.standingRange + modifiers.standingRangeDelta;
  const attackMinRange = slot.definition.attackMinRange + modifiers.attackMinRangeDelta;
  const attackMaxRange = slot.definition.attackMaxRange + modifiers.attackMaxRangeDelta;
  const moveSpeed = slot.definition.moveSpeed + modifiers.moveSpeedDelta;
  if (standingRange < 0 || attackMinRange < 0 || attackMaxRange < 0 || attackMinRange > attackMaxRange) throw new Error(`Evolution form produces invalid ranges: ${formId}`);
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
      ...(modifiers.damageBonuses === undefined ? {} : { damageBonuses: modifiers.damageBonuses }),
    },
  };
}

export function buildCharacterCombatSlot(slot: PlayerRosterSlot, level: number, formId?: string, plusLevel = 0): PlayerRosterSlot {
  const leveled = applyCharacterLevel(slot, level, plusLevel);
  return formId ? applyEvolutionForm(leveled, formId) : leveled;
}
