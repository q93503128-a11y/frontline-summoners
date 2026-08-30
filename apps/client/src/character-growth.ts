import type { PlayerRosterSlot } from '@frontline/sim/playable';
import {
  applyCharacterLevel as applyCharacterLevelShared,
  applyEvolutionForm as applyEvolutionFormShared,
  buildCharacterCombatSlot as buildCharacterCombatSlotShared,
  getCharacterLevelMultiplierPermille as getCharacterLevelMultiplierPermilleShared,
  getCharacterTotalMultiplierPermille as getCharacterTotalMultiplierPermilleShared,
  getEvolutionForm as getEvolutionFormShared,
  normalizeCharacterLevel as normalizeCharacterLevelShared,
  normalizeCharacterPlusLevel as normalizeCharacterPlusLevelShared,
  type CharacterLevelAnchor,
  type CharacterLevelCurve,
  type EvolutionFormDefinition,
  type EvolutionFormModifiers,
} from '@frontline/sim/meta-progression';
import {
  applyEvolutionCatalogOverrides,
  buildEvolutionCatalog,
  getEvolutionRecipe as getEvolutionRecipeShared,
  type EvolutionRecipeDefinition,
  type EvolutionResourceId,
} from '@frontline/sim/evolution-catalog';
import levelCurveJson from '../../../content/growth/level-curve-01.json' with { type: 'json' };
import evolutionCatalogJson from '../../../content/evolution/catalog-01.json' with { type: 'json' };
import storyEvolutionOverridesJson from '../../../content/evolution/story-01-overrides.json' with { type: 'json' };
import { ALL_PLAYER_SLOTS } from './prototype.ts';

export type {
  CharacterLevelAnchor,
  CharacterLevelCurve,
  EvolutionFormDefinition,
  EvolutionFormModifiers,
  EvolutionRecipeDefinition,
  EvolutionResourceId,
};

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
function parseLevelCurve(value: unknown): CharacterLevelCurve {
  const raw = record(value, 'level curve');
  if (raw.status !== 'DESIGN_TARGET') throw new Error('level curve status must be DESIGN_TARGET');
  const levelCap = integer(raw.levelCap, 'levelCap', 1, 100);
  const plusLevelCap = integer(raw.plusLevelCap, 'plusLevelCap', 0, 200);
  if (!Array.isArray(raw.anchors) || raw.anchors.length < 2) throw new Error('level curve anchors must contain at least two entries');
  const anchors = raw.anchors.map((entry, index) => {
    const anchor = record(entry, `anchors[${index}]`);
    return {
      level: integer(anchor.level, `anchors[${index}].level`, 1, levelCap),
      multiplierPermille: integer(anchor.multiplierPermille, `anchors[${index}].multiplierPermille`, 1, 100000),
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
const EVOLUTION_SOURCE = applyEvolutionCatalogOverrides(evolutionCatalogJson, storyEvolutionOverridesJson);
const EVOLUTION_CATALOG = buildEvolutionCatalog(EVOLUTION_SOURCE, new Set(ALL_PLAYER_SLOTS.map((slot) => slot.slotId)));
export const EVOLUTION_FORMS: readonly EvolutionFormDefinition[] = EVOLUTION_CATALOG.forms;
export const EVOLUTION_RECIPES: readonly EvolutionRecipeDefinition[] = EVOLUTION_CATALOG.recipes;

export function normalizeCharacterLevel(level: number): number { return normalizeCharacterLevelShared(CHARACTER_LEVEL_CURVE, level); }
export function normalizeCharacterPlusLevel(plusLevel: number): number { return normalizeCharacterPlusLevelShared(CHARACTER_LEVEL_CURVE, plusLevel); }
export function getCharacterLevelMultiplierPermille(level: number): number { return getCharacterLevelMultiplierPermilleShared(CHARACTER_LEVEL_CURVE, level); }
export function getCharacterTotalMultiplierPermille(level: number, plusLevel = 0): number { return getCharacterTotalMultiplierPermilleShared(CHARACTER_LEVEL_CURVE, level, plusLevel); }
export function applyCharacterLevel(slot: PlayerRosterSlot, level: number, plusLevel = 0): PlayerRosterSlot { return applyCharacterLevelShared(slot, CHARACTER_LEVEL_CURVE, level, plusLevel); }
export function getEvolutionForms(characterId: string): readonly EvolutionFormDefinition[] { return EVOLUTION_FORMS.filter((form) => form.characterId === characterId); }
export function getEvolutionForm(formId: string): EvolutionFormDefinition { return getEvolutionFormShared(EVOLUTION_FORMS, formId); }
export function getEvolutionRecipe(formId: string): EvolutionRecipeDefinition { return getEvolutionRecipeShared(EVOLUTION_RECIPES, formId); }
export function applyEvolutionForm(slot: PlayerRosterSlot, formId: string): PlayerRosterSlot { return applyEvolutionFormShared(slot, EVOLUTION_FORMS, formId); }
export function buildCharacterCombatSlot(slot: PlayerRosterSlot, level: number, formId?: string, plusLevel = 0): PlayerRosterSlot {
  return buildCharacterCombatSlotShared(slot, CHARACTER_LEVEL_CURVE, EVOLUTION_FORMS, level, formId, plusLevel);
}
