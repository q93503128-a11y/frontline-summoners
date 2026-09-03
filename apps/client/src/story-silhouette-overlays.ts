export type StorySilhouetteOverlaySpec = GuardShieldOverlaySpec | LancerSpearOverlaySpec;

export interface GuardShieldOverlaySpec {
  readonly kind: 'GUARD_SHIELD';
  readonly key: string;
  readonly shieldWidth: number;
  readonly shieldHeight: number;
  readonly frontOffsetX: number;
  readonly verticalOffset: number;
  readonly battlementCount: number;
  readonly skidWidth: number;
  readonly wheelRadius: number;
  readonly fillColor: number;
  readonly rimColor: number;
}

export interface LancerSpearOverlaySpec {
  readonly kind: 'LANCER_SPEAR';
  readonly key: string;
  readonly rearExtent: number;
  readonly shaftForward: number;
  readonly shaftThickness: number;
  readonly bladeLength: number;
  readonly bladeHalfHeight: number;
  readonly verticalOffset: number;
  readonly bannerDrop: number;
  readonly shaftColor: number;
  readonly bladeColor: number;
  readonly bannerColor: number;
}

const GUARD_SPECS: Readonly<Record<string, GuardShieldOverlaySpec>> = {
  guard_f1: {
    kind: 'GUARD_SHIELD', key: 'guard-f1-wall-shield',
    shieldWidth: 46, shieldHeight: 88, frontOffsetX: 13, verticalOffset: 10,
    battlementCount: 0, skidWidth: 0, wheelRadius: 0,
    fillColor: 0x5c5145, rimColor: 0xaeb7bf,
  },
  guard_f2: {
    kind: 'GUARD_SHIELD', key: 'guard-f2-gate-shield',
    shieldWidth: 55, shieldHeight: 98, frontOffsetX: 14, verticalOffset: 10,
    battlementCount: 3, skidWidth: 0, wheelRadius: 0,
    fillColor: 0x4a5665, rimColor: 0xc2ccd4,
  },
  guard_f3: {
    kind: 'GUARD_SHIELD', key: 'guard-f3-moving-wall',
    shieldWidth: 64, shieldHeight: 106, frontOffsetX: 12, verticalOffset: 12,
    battlementCount: 4, skidWidth: 58, wheelRadius: 4,
    fillColor: 0x404a57, rimColor: 0xd4dee7,
  },
};

const LANCER_SPECS: Readonly<Record<string, LancerSpearOverlaySpec>> = {
  lancer_f1: {
    kind: 'LANCER_SPEAR', key: 'lancer-f1-broad-spear',
    rearExtent: 38, shaftForward: 88, shaftThickness: 5,
    bladeLength: 25, bladeHalfHeight: 11, verticalOffset: -8, bannerDrop: 20,
    shaftColor: 0x526276, bladeColor: 0xbfd7e8, bannerColor: 0x416ea4,
  },
  lancer_f2: {
    kind: 'LANCER_SPEAR', key: 'lancer-f2-formation-pike',
    rearExtent: 46, shaftForward: 116, shaftThickness: 5,
    bladeLength: 24, bladeHalfHeight: 9, verticalOffset: -5, bannerDrop: 29,
    shaftColor: 0x4a5d72, bladeColor: 0xc9deed, bannerColor: 0x315d94,
  },
  lancer_f3: {
    kind: 'LANCER_SPEAR', key: 'lancer-f3-linebreaker-spear',
    rearExtent: 34, shaftForward: 86, shaftThickness: 6,
    bladeLength: 36, bladeHalfHeight: 17, verticalOffset: -7, bannerDrop: 18,
    shaftColor: 0x43596f, bladeColor: 0xd5e8f4, bannerColor: 0x294f86,
  },
};

/**
 * Presentation-only silhouette scaffolding for story forms whose canonical weapon/body shape
 * cannot be represented honestly by the current CC0 human reference families.
 * These specs are not production assets and must never satisfy an art approval/review gate.
 */
export function getStorySilhouetteOverlaySpec(
  unitId: string,
  resolvedFormId?: string,
): StorySilhouetteOverlaySpec | undefined {
  if (!resolvedFormId) return undefined;
  if (unitId === 'guard') return GUARD_SPECS[resolvedFormId];
  if (unitId === 'lancer') return LANCER_SPECS[resolvedFormId];
  return undefined;
}
