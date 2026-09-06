export interface Pvp2v2CompactRailLayout {
  readonly controlCount: number;
  readonly margin: number;
  readonly gap: number;
  readonly buttonWidth: number;
  readonly buttonHeight: number;
  readonly panelTop: number;
  readonly buttonY: number;
}

/** Five summon cells plus supply/base-weapon commands on one fit-aware row. */
export function computePvp2v2CompactRailLayout(minimumTouch: number, slotCount = 5): Pvp2v2CompactRailLayout {
  const controlCount = Math.max(2, slotCount + 2);
  const safeTouch = Math.max(44, Math.ceil(minimumTouch));
  const freeAfterTouch = Math.max(0, 1280 - safeTouch * controlCount);
  const margin = Math.min(16, Math.floor(freeAfterTouch / 4));
  const remainingForGaps = Math.max(0, freeAfterTouch - margin * 2);
  const gap = Math.min(6, Math.floor(remainingForGaps / Math.max(1, controlCount - 1)));
  const available = 1280 - margin * 2;
  const buttonWidth = Math.floor((available - gap * (controlCount - 1)) / controlCount);
  const buttonHeight = Math.max(92, safeTouch);
  const panelTop = Math.max(520, 720 - buttonHeight - 16);
  const buttonY = panelTop + buttonHeight / 2 + 8;
  return { controlCount, margin, gap, buttonWidth, buttonHeight, panelTop, buttonY };
}
