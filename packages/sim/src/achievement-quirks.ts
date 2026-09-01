export const STORY_TEN_LATE_QUIRK_STAGE_ID = 'main_04_020' as const;

/** The first-completion STORY roster is exactly these ten characters. */
export const STORY_TEN_QUIRK_CHARACTER_IDS = [
  'militia',
  'guard',
  'hunter',
  'duelist',
  'lancer',
  'battlemage',
  'pyromancer',
  'royal',
  'heretic',
  'voidsage',
] as const;

const STORY_TEN_SET = new Set<string>(STORY_TEN_QUIRK_CHARACTER_IDS);

/**
 * Hidden challenge: clear the final MAIN stage using the complete ten-character STORY roster and nothing else.
 * Order does not matter, but all ten slots must be filled by the canonical STORY ten with no duplicate.
 */
export function qualifiesStoryTenLateQuirk(stageId: string, deckSlotIds: readonly string[]): boolean {
  if (stageId !== STORY_TEN_LATE_QUIRK_STAGE_ID) return false;
  if (deckSlotIds.length !== STORY_TEN_QUIRK_CHARACTER_IDS.length) return false;
  const deck = new Set(deckSlotIds);
  if (deck.size !== STORY_TEN_QUIRK_CHARACTER_IDS.length) return false;
  return STORY_TEN_QUIRK_CHARACTER_IDS.every((characterId) => deck.has(characterId))
    && [...deck].every((characterId) => STORY_TEN_SET.has(characterId));
}
