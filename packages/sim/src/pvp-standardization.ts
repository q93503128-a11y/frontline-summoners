import {
  buildCharacterCombatSlot,
  type CharacterLevelCurve,
  type EvolutionFormDefinition,
} from './meta-progression.ts';
import type { PlayerRosterSlot } from './playable.ts';
import { PVP_STANDARDIZATION } from './pvp-content.ts';

export interface PvpCharacterSelection {
  readonly characterId: string;
  readonly formId: string;
}

export interface PvpStandardizationCharacterSource {
  readonly baseSlot: PlayerRosterSlot;
  readonly curve: CharacterLevelCurve;
  readonly forms: readonly EvolutionFormDefinition[];
  readonly owned: boolean;
  readonly unlockedFormIds: readonly string[];
}

export interface PvpStandardizedRosterInput {
  readonly selections: readonly PvpCharacterSelection[];
  readonly characters: readonly PvpStandardizationCharacterSource[];
  readonly requiredSlots: 5 | 10;
}

export type PvpStandardizationFailure =
  | 'wrong_slot_count'
  | 'duplicate_character'
  | 'unknown_character'
  | 'character_not_owned'
  | 'form_not_unlocked'
  | 'form_character_mismatch';

export type PvpStandardizedRosterResult =
  | { readonly ok: true; readonly slots: readonly PlayerRosterSlot[] }
  | {
    readonly ok: false;
    readonly reason: PvpStandardizationFailure;
    readonly characterId?: string;
    readonly formId?: string;
  };

/**
 * Builds the canonical standard-growth roster used by PvP public queues.
 * Ownership and actual evolution unlocks remain meaningful, while level/+level and
 * permanent account combat growth are removed by construction.
 */
export function buildStandardizedPvpRoster(input: PvpStandardizedRosterInput): PvpStandardizedRosterResult {
  if (input.selections.length !== input.requiredSlots) return { ok: false, reason: 'wrong_slot_count' };
  const selectedIds = input.selections.map((selection) => selection.characterId);
  if (new Set(selectedIds).size !== selectedIds.length) return { ok: false, reason: 'duplicate_character' };
  const sourceById = new Map(input.characters.map((source) => [source.baseSlot.slotId, source] as const));
  const slots: PlayerRosterSlot[] = [];
  for (const selection of input.selections) {
    const source = sourceById.get(selection.characterId);
    if (!source) return { ok: false, reason: 'unknown_character', characterId: selection.characterId };
    if (!source.owned) return { ok: false, reason: 'character_not_owned', characterId: selection.characterId };
    if (!source.unlockedFormIds.includes(selection.formId)) {
      return {
        ok: false,
        reason: 'form_not_unlocked',
        characterId: selection.characterId,
        formId: selection.formId,
      };
    }
    const form = source.forms.find((candidate) => candidate.formId === selection.formId);
    if (!form || form.characterId !== selection.characterId) {
      return {
        ok: false,
        reason: 'form_character_mismatch',
        characterId: selection.characterId,
        formId: selection.formId,
      };
    }
    slots.push(buildCharacterCombatSlot(
      source.baseSlot,
      source.curve,
      source.forms,
      PVP_STANDARDIZATION.baseLevel,
      selection.formId,
      PVP_STANDARDIZATION.plusLevel,
    ));
  }
  return { ok: true, slots };
}

export interface PvpActualGrowthSelection extends PvpCharacterSelection {
  readonly level: number;
  readonly plusLevel: number;
}

export interface PvpActualGrowthRosterInput {
  readonly selections: readonly PvpActualGrowthSelection[];
  readonly characters: readonly PvpStandardizationCharacterSource[];
  readonly requiredSlots: 5 | 10;
}

/**
 * Friendly-only actual-growth helper. Public casual/ranked modes must not call this.
 * Permanent reward application remains an explicit caller responsibility so a
 * standard-growth path cannot accidentally inherit account-wide bonuses.
 */
export function buildActualGrowthFriendlyPvpRoster(input: PvpActualGrowthRosterInput): PvpStandardizedRosterResult {
  if (input.selections.length !== input.requiredSlots) return { ok: false, reason: 'wrong_slot_count' };
  const selectedIds = input.selections.map((selection) => selection.characterId);
  if (new Set(selectedIds).size !== selectedIds.length) return { ok: false, reason: 'duplicate_character' };
  const sourceById = new Map(input.characters.map((source) => [source.baseSlot.slotId, source] as const));
  const slots: PlayerRosterSlot[] = [];
  for (const selection of input.selections) {
    const source = sourceById.get(selection.characterId);
    if (!source) return { ok: false, reason: 'unknown_character', characterId: selection.characterId };
    if (!source.owned) return { ok: false, reason: 'character_not_owned', characterId: selection.characterId };
    if (!source.unlockedFormIds.includes(selection.formId)) {
      return {
        ok: false,
        reason: 'form_not_unlocked',
        characterId: selection.characterId,
        formId: selection.formId,
      };
    }
    const form = source.forms.find((candidate) => candidate.formId === selection.formId);
    if (!form || form.characterId !== selection.characterId) {
      return {
        ok: false,
        reason: 'form_character_mismatch',
        characterId: selection.characterId,
        formId: selection.formId,
      };
    }
    slots.push(buildCharacterCombatSlot(
      source.baseSlot,
      source.curve,
      source.forms,
      selection.level,
      selection.formId,
      selection.plusLevel,
    ));
  }
  return { ok: true, slots };
}
