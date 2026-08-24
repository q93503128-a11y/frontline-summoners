export const COMPACT_MOBILE_SHORT_SIDE = 540;
export const PORTRAIT_MOBILE_MAX_WIDTH = 900;

export function shouldUseCompactMobileUi(width: number, height: number, coarsePointer: boolean): boolean {
  return coarsePointer && Math.min(width, height) <= COMPACT_MOBILE_SHORT_SIDE;
}

export function shouldBlockPortraitMobile(width: number, height: number, coarsePointer: boolean): boolean {
  return coarsePointer && width <= PORTRAIT_MOBILE_MAX_WIDTH && height > width;
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
