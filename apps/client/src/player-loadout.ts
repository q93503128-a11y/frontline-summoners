import type { PlayableBattleState } from '@frontline/sim/playable';
import { buildCharacterCombatSlot } from './character-growth.ts';
import {
  createPrototypeBattleWithPlayerSlots,
  getSlotById,
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
    const resolved = buildCharacterCombatSlot(baseSlot, meta?.level ?? 1, meta?.selectedFormId);
    return {
      ...baseSlot,
      ...resolved,
      definition: resolved.definition,
    };
  });
}

export function createGuestPrototypeBattle(
  stageId: string,
  progress: GuestProgress,
): PlayableBattleState {
  const normalized = normalizeGuestProgress(progress);
  return createPrototypeBattleWithPlayerSlots(
    stageId,
    buildGuestDeckSlots(normalized),
    normalized.treasureIds,
  );
}
