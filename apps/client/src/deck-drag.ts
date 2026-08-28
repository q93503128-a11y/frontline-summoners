export const DECK_SLOT_WIDTH = 112;
export const DECK_START_X = 76;
export const DECK_SLOT_COUNT = 10;

export function getDeckDropIndex(
  x: number,
  y: number,
  compact: boolean,
): number | undefined {
  const centerY = compact ? 140 : 142;
  const verticalTolerance = compact ? 58 : 48;
  if (Math.abs(y - centerY) > verticalTolerance) return undefined;
  const relativeX = x - DECK_START_X;
  if (relativeX < 0 || relativeX >= DECK_SLOT_WIDTH * DECK_SLOT_COUNT) return undefined;
  return Math.floor(relativeX / DECK_SLOT_WIDTH);
}

export function placeCharacterAtDeckIndex(
  currentIds: readonly string[],
  characterId: string,
  requestedIndex: number,
  maxSlots = DECK_SLOT_COUNT,
): string[] {
  const targetIndex = Math.trunc(requestedIndex);
  if (!characterId || targetIndex < 0 || targetIndex >= maxSlots) return [...currentIds];

  const next = [...currentIds].slice(0, maxSlots);
  const existingIndex = next.indexOf(characterId);

  if (existingIndex >= 0) {
    if (next.length <= 1) return next;
    if (targetIndex >= next.length) {
      next.splice(existingIndex, 1);
      next.push(characterId);
      return next;
    }
    if (existingIndex === targetIndex) return next;
    const targetCharacterId = next[targetIndex]!;
    next[targetIndex] = characterId;
    next[existingIndex] = targetCharacterId;
    return next;
  }

  if (targetIndex < next.length) {
    next[targetIndex] = characterId;
    return next;
  }
  if (next.length < maxSlots) next.push(characterId);
  return next;
}
