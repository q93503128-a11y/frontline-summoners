import type { PlayableBattleState } from '@frontline/sim/playable';
import { getFormationRestrictionViolation } from '@frontline/sim/formation-restrictions';
import { buildCharacterCombatSlot } from './character-growth.ts';
import {
  createPrototypeBattleWithPlayerSlots,
  getSlotById,
  getStage,
  type PrototypeRosterSlot,
} from './prototype.ts';
import {
  getEffectiveDeckSlotIds,
  normalizeGuestProgress,
  type GuestProgress,
} from './save.ts';

export function buildGuestDeckSlots(progress: GuestProgress): readonly PrototypeRosterSlot[] {
  const normalized = normalizeGuestProgress(progress);
  const deckSlotIds = getEffectiveDeckSlotIds(normalized);
  const characterProgress = normalized.characterProgressById ?? {};

  return deckSlotIds.map((slotId) => {
    const baseSlot = getSlotById(slotId);
    if (!baseSlot) throw new Error(`Unknown deck character: ${slotId}`);
    const meta = characterProgress[slotId];
    const resolved = buildCharacterCombatSlot(
      baseSlot,
      meta?.level ?? 1,
      meta?.selectedFormId,
      meta?.plusLevel ?? 0,
    );
    return {
      ...baseSlot,
      ...resolved,
      definition: resolved.definition,
    };
  });
}

export function getGuestStageFormationViolation(
  stageId: string,
  progress: GuestProgress,
): string | undefined {
  const stage = getStage(stageId);
  const slots = buildGuestDeckSlots(progress);
  return getFormationRestrictionViolation(
    stage.formationRestrictions,
    slots.map((slot) => ({
      slotId: slot.slotId,
      cost: slot.cost,
      rarity: slot.rarity,
      acquisitionClass: slot.acquisitionClass,
      role: slot.role,
      unitTags: slot.definition.combatTags,
    })),
  );
}

export function createGuestPrototypeBattle(
  stageId: string,
  progress: GuestProgress,
): PlayableBattleState {
  const normalized = normalizeGuestProgress(progress);
  const playerSlots = buildGuestDeckSlots(normalized);
  const violation = getGuestStageFormationViolation(stageId, normalized);
  if (violation) throw new Error(`formation_restricted:${stageId}:${violation}`);
  return createPrototypeBattleWithPlayerSlots(
    stageId,
    playerSlots,
    normalized.permanentRewardIds,
  );
}
