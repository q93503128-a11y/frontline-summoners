import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';

export const COMPACT_MOBILE_SHORT_SIDE = 540;
export const PORTRAIT_MOBILE_MAX_WIDTH = 900;
export const MIN_TOUCH_TARGET_CSS_PX = 44;

export function shouldUseCompactMobileUi(width: number, height: number, coarsePointer: boolean): boolean {
  return coarsePointer && Math.min(width, height) <= COMPACT_MOBILE_SHORT_SIDE;
}

export function shouldBlockPortraitMobile(width: number, height: number, coarsePointer: boolean): boolean {
  return coarsePointer && width <= PORTRAIT_MOBILE_MAX_WIDTH && height > width;
}

/** Phaser.Scale.FIT scale from the fixed 1280×720 logical canvas into the available CSS viewport. */
export function getFitCssScale(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1;
  return Math.min(width / INTERNAL_WIDTH, height / INTERNAL_HEIGHT);
}

/**
 * Minimum logical-canvas size needed to produce a requested CSS-pixel touch target after Scale.FIT.
 * Scenes can use this when a compact layout changes geometry instead of only shrinking text.
 */
export function getMinimumInternalTouchTarget(
  width: number,
  height: number,
  targetCssPx = MIN_TOUCH_TARGET_CSS_PX,
): number {
  const scale = getFitCssScale(width, height);
  return Math.ceil(targetCssPx / Math.max(0.01, scale));
}

function hasCoarsePrimaryPointer(): boolean {
  if (typeof window.matchMedia === 'function') return window.matchMedia('(pointer: coarse)').matches;
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
}

export function isCompactMobileViewport(): boolean {
  return shouldUseCompactMobileUi(window.innerWidth, window.innerHeight, hasCoarsePrimaryPointer());
}

export function isPortraitMobileViewport(): boolean {
  return shouldBlockPortraitMobile(window.innerWidth, window.innerHeight, hasCoarsePrimaryPointer());
}

export function getCurrentMinimumInternalTouchTarget(targetCssPx = MIN_TOUCH_TARGET_CSS_PX): number {
  if (typeof window === 'undefined') return targetCssPx;
  return getMinimumInternalTouchTarget(window.innerWidth, window.innerHeight, targetCssPx);
}
