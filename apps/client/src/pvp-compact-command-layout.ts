export interface PvpCompactCommandLayout {
  readonly margin: number;
  readonly gap: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly buttonWidth: number;
  readonly buttonHeight: number;
  readonly panelTop: number;
  readonly buttonY: number;
}

/**
 * Fit-aware compact PvP command rail.
 * Three command cells are always reserved for page/supply/base-weapon controls.
 */
export function computePvpCompactCommandLayout(minimumTouch: number, slotCount = 10): PvpCompactCommandLayout {
  const margin = 16;
  const gap = 6;
  const availableWidth = 1280 - margin * 2;
  const safeTouch = Math.max(44, Math.ceil(minimumTouch));
  const maxControls = Math.max(4, Math.floor((availableWidth + gap) / (safeTouch + gap)));
  const pageSize = Math.max(1, Math.min(slotCount, maxControls - 3));
  const visibleSlots = Math.min(slotCount, pageSize);
  const controlCount = Math.max(4, visibleSlots + 3);
  const buttonWidth = Math.floor((availableWidth - gap * (controlCount - 1)) / controlCount);
  const buttonHeight = Math.max(92, safeTouch);
  const panelTop = Math.max(520, 720 - buttonHeight - 16);
  const buttonY = panelTop + buttonHeight / 2 + 8;
  return {
    margin,
    gap,
    pageSize,
    pageCount: Math.max(1, Math.ceil(slotCount / pageSize)),
    buttonWidth,
    buttonHeight,
    panelTop,
    buttonY,
  };
}
