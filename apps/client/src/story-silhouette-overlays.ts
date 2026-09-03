export type StorySilhouetteOverlaySpec =
  | GuardShieldOverlaySpec
  | LancerSpearOverlaySpec
  | HunterPolearmOverlaySpec
  | DuelistBladeOverlaySpec
  | ArcaneFrameOverlaySpec
  | FurnaceOverlaySpec
  | GreatbladeOverlaySpec
  | RitualOverlaySpec
  | VoidOrbitOverlaySpec;

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

export interface HunterPolearmOverlaySpec {
  readonly kind: 'HUNTER_POLEARM';
  readonly key: string;
  readonly rearExtent: number;
  readonly shaftForward: number;
  readonly shaftThickness: number;
  readonly bladeLength: number;
  readonly bladeHalfHeight: number;
  readonly hookDepth: number;
  readonly trophyCount: number;
  readonly bannerDrop: number;
  readonly shaftColor: number;
  readonly bladeColor: number;
  readonly trophyColor: number;
}

export interface DuelistBladeOverlaySpec {
  readonly kind: 'DUELIST_BLADE';
  readonly key: string;
  readonly bladeLength: number;
  readonly bladeWidth: number;
  readonly guardWidth: number;
  readonly scabbardLength: number;
  readonly offhandDaggerLength: number;
  readonly coatTailLength: number;
  readonly bladeColor: number;
  readonly accentColor: number;
}

export interface ArcaneFrameOverlaySpec {
  readonly kind: 'ARCANE_FRAME';
  readonly key: string;
  readonly frameRadius: number;
  readonly plateCount: number;
  readonly plateLength: number;
  readonly frameOffsetX: number;
  readonly frameOffsetY: number;
  readonly staffLength: number;
  readonly frameColor: number;
  readonly glowColor: number;
}

export interface FurnaceOverlaySpec {
  readonly kind: 'FURNACE';
  readonly key: string;
  readonly furnaceWidth: number;
  readonly furnaceHeight: number;
  readonly backOffsetX: number;
  readonly verticalOffset: number;
  readonly ringRadius: number;
  readonly floating: boolean;
  readonly crackCount: number;
  readonly bodyColor: number;
  readonly emberColor: number;
}

export interface GreatbladeOverlaySpec {
  readonly kind: 'GREATBLADE';
  readonly key: string;
  readonly bladeLength: number;
  readonly bladeWidth: number;
  readonly guardWidth: number;
  readonly rearOffset: number;
  readonly featherHeight: number;
  readonly bladeColor: number;
  readonly accentColor: number;
}

export interface RitualOverlaySpec {
  readonly kind: 'RITUAL';
  readonly key: string;
  readonly ringRadius: number;
  readonly talismanCount: number;
  readonly toolLength: number;
  readonly splitTools: boolean;
  readonly offsetX: number;
  readonly ritualColor: number;
  readonly paperColor: number;
}

export interface VoidOrbitOverlaySpec {
  readonly kind: 'VOID_ORBIT';
  readonly key: string;
  readonly shardCount: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly shardLength: number;
  readonly shardWidth: number;
  readonly offsetX: number;
  readonly shardColor: number;
  readonly rimColor: number;
}

const GUARD_SPECS: Readonly<Record<string, GuardShieldOverlaySpec>> = {
  guard_f1: { kind: 'GUARD_SHIELD', key: 'guard-f1-wall-shield', shieldWidth: 46, shieldHeight: 88, frontOffsetX: 13, verticalOffset: 10, battlementCount: 0, skidWidth: 0, wheelRadius: 0, fillColor: 0x5c5145, rimColor: 0xaeb7bf },
  guard_f2: { kind: 'GUARD_SHIELD', key: 'guard-f2-gate-shield', shieldWidth: 55, shieldHeight: 98, frontOffsetX: 14, verticalOffset: 10, battlementCount: 3, skidWidth: 0, wheelRadius: 0, fillColor: 0x4a5665, rimColor: 0xc2ccd4 },
  guard_f3: { kind: 'GUARD_SHIELD', key: 'guard-f3-moving-wall', shieldWidth: 64, shieldHeight: 106, frontOffsetX: 12, verticalOffset: 12, battlementCount: 4, skidWidth: 58, wheelRadius: 4, fillColor: 0x404a57, rimColor: 0xd4dee7 },
};

const HUNTER_SPECS: Readonly<Record<string, HunterPolearmOverlaySpec>> = {
  hunter_f1: { kind: 'HUNTER_POLEARM', key: 'hunter-f1-hunting-spear', rearExtent: 30, shaftForward: 78, shaftThickness: 4, bladeLength: 21, bladeHalfHeight: 7, hookDepth: 0, trophyCount: 0, bannerDrop: 0, shaftColor: 0x765b42, bladeColor: 0xc6d3d9, trophyColor: 0x9b7450 },
  hunter_f2: { kind: 'HUNTER_POLEARM', key: 'hunter-f2-beast-hook', rearExtent: 34, shaftForward: 88, shaftThickness: 4, bladeLength: 27, bladeHalfHeight: 9, hookDepth: 13, trophyCount: 3, bannerDrop: 0, shaftColor: 0x695039, bladeColor: 0xd5ddd9, trophyColor: 0xb98b5d },
  hunter_f3: { kind: 'HUNTER_POLEARM', key: 'hunter-f3-royal-hunt-pike', rearExtent: 43, shaftForward: 112, shaftThickness: 4, bladeLength: 25, bladeHalfHeight: 8, hookDepth: 8, trophyCount: 1, bannerDrop: 24, shaftColor: 0x5c4939, bladeColor: 0xd9e5e7, trophyColor: 0x8a4f45 },
};

const DUELIST_SPECS: Readonly<Record<string, DuelistBladeOverlaySpec>> = {
  duelist_f1: { kind: 'DUELIST_BLADE', key: 'duelist-f1-rapier', bladeLength: 52, bladeWidth: 4, guardWidth: 16, scabbardLength: 0, offhandDaggerLength: 0, coatTailLength: 15, bladeColor: 0xd8e1e7, accentColor: 0xa37c5b },
  duelist_f2: { kind: 'DUELIST_BLADE', key: 'duelist-f2-blade-dance', bladeLength: 48, bladeWidth: 4, guardWidth: 18, scabbardLength: 0, offhandDaggerLength: 27, coatTailLength: 31, bladeColor: 0xe0e8ec, accentColor: 0x8f5362 },
  duelist_f3: { kind: 'DUELIST_BLADE', key: 'duelist-f3-iaijutsu', bladeLength: 68, bladeWidth: 3, guardWidth: 13, scabbardLength: 58, offhandDaggerLength: 0, coatTailLength: 9, bladeColor: 0xf0f3f4, accentColor: 0x4d5565 },
};

const LANCER_SPECS: Readonly<Record<string, LancerSpearOverlaySpec>> = {
  lancer_f1: { kind: 'LANCER_SPEAR', key: 'lancer-f1-broad-spear', rearExtent: 38, shaftForward: 88, shaftThickness: 5, bladeLength: 25, bladeHalfHeight: 11, verticalOffset: -8, bannerDrop: 20, shaftColor: 0x526276, bladeColor: 0xbfd7e8, bannerColor: 0x416ea4 },
  lancer_f2: { kind: 'LANCER_SPEAR', key: 'lancer-f2-formation-pike', rearExtent: 46, shaftForward: 116, shaftThickness: 5, bladeLength: 24, bladeHalfHeight: 9, verticalOffset: -5, bannerDrop: 29, shaftColor: 0x4a5d72, bladeColor: 0xc9deed, bannerColor: 0x315d94 },
  lancer_f3: { kind: 'LANCER_SPEAR', key: 'lancer-f3-linebreaker-spear', rearExtent: 34, shaftForward: 86, shaftThickness: 6, bladeLength: 36, bladeHalfHeight: 17, verticalOffset: -7, bannerDrop: 18, shaftColor: 0x43596f, bladeColor: 0xd5e8f4, bannerColor: 0x294f86 },
};

const BATTLEMAGE_SPECS: Readonly<Record<string, ArcaneFrameOverlaySpec>> = {
  battlemage_f1: { kind: 'ARCANE_FRAME', key: 'battlemage-f1-tactical-board', frameRadius: 17, plateCount: 1, plateLength: 16, frameOffsetX: 18, frameOffsetY: -7, staffLength: 32, frameColor: 0xc8ba85, glowColor: 0xf0df9b },
  battlemage_f2: { kind: 'ARCANE_FRAME', key: 'battlemage-f2-field-array', frameRadius: 24, plateCount: 3, plateLength: 18, frameOffsetX: 10, frameOffsetY: -9, staffLength: 23, frameColor: 0xb8c5cf, glowColor: 0xe8e1c5 },
  battlemage_f3: { kind: 'ARCANE_FRAME', key: 'battlemage-f3-artillery-frame', frameRadius: 38, plateCount: 6, plateLength: 23, frameOffsetX: -8, frameOffsetY: -11, staffLength: 13, frameColor: 0xaebbc4, glowColor: 0xf1e7c8 },
};

const PYROMANCER_SPECS: Readonly<Record<string, FurnaceOverlaySpec>> = {
  pyromancer_f1: { kind: 'FURNACE', key: 'pyromancer-f1-back-furnace', furnaceWidth: 27, furnaceHeight: 42, backOffsetX: -24, verticalOffset: 1, ringRadius: 0, floating: false, crackCount: 2, bodyColor: 0x5f5147, emberColor: 0xf1944b },
  pyromancer_f2: { kind: 'FURNACE', key: 'pyromancer-f2-hearth-keeper', furnaceWidth: 42, furnaceHeight: 48, backOffsetX: -18, verticalOffset: 5, ringRadius: 0, floating: false, crackCount: 4, bodyColor: 0x55473f, emberColor: 0xff8b42 },
  pyromancer_f3: { kind: 'FURNACE', key: 'pyromancer-f3-calamity-ring', furnaceWidth: 23, furnaceHeight: 29, backOffsetX: -10, verticalOffset: -8, ringRadius: 38, floating: true, crackCount: 7, bodyColor: 0x4a3d39, emberColor: 0xff6f3d },
};

const ROYAL_SPECS: Readonly<Record<string, GreatbladeOverlaySpec>> = {
  royal_f1: { kind: 'GREATBLADE', key: 'royal-f1-broad-greatblade', bladeLength: 68, bladeWidth: 13, guardWidth: 28, rearOffset: 15, featherHeight: 24, bladeColor: 0xcbd1d5, accentColor: 0xb89a63 },
  royal_f2: { kind: 'GREATBLADE', key: 'royal-f2-captain-guard', bladeLength: 72, bladeWidth: 19, guardWidth: 38, rearOffset: 12, featherHeight: 31, bladeColor: 0xbfc8cf, accentColor: 0xd0aa65 },
  royal_f3: { kind: 'GREATBLADE', key: 'royal-f3-kings-blade', bladeLength: 84, bladeWidth: 9, guardWidth: 22, rearOffset: 7, featherHeight: 15, bladeColor: 0xe2e6e8, accentColor: 0xc79d59 },
};

const HERETIC_SPECS: Readonly<Record<string, RitualOverlaySpec>> = {
  heretic_f1: { kind: 'RITUAL', key: 'heretic-f1-asymmetric-charms', ringRadius: 0, talismanCount: 3, toolLength: 58, splitTools: false, offsetX: -9, ritualColor: 0x746679, paperColor: 0xd8c8a1 },
  heretic_f2: { kind: 'RITUAL', key: 'heretic-f2-forbidden-ring', ringRadius: 34, talismanCount: 7, toolLength: 72, splitTools: false, offsetX: -13, ritualColor: 0x65536c, paperColor: 0xe0c999 },
  heretic_f3: { kind: 'RITUAL', key: 'heretic-f3-reverse-tools', ringRadius: 0, talismanCount: 4, toolLength: 34, splitTools: true, offsetX: 4, ritualColor: 0x564b60, paperColor: 0xd7b98a },
};

const VOIDSAGE_SPECS: Readonly<Record<string, VoidOrbitOverlaySpec>> = {
  voidsage_f1: { kind: 'VOID_ORBIT', key: 'voidsage-f1-three-shards', shardCount: 3, radiusX: 25, radiusY: 38, shardLength: 18, shardWidth: 7, offsetX: 0, shardColor: 0x343941, rimColor: 0xb7c0c8 },
  voidsage_f2: { kind: 'VOID_ORBIT', key: 'voidsage-f2-rift-shards', shardCount: 5, radiusX: 34, radiusY: 46, shardLength: 21, shardWidth: 8, offsetX: -2, shardColor: 0x2c3138, rimColor: 0xc1c7cc },
  voidsage_f3: { kind: 'VOID_ORBIT', key: 'voidsage-f3-space-fracture', shardCount: 7, radiusX: 45, radiusY: 55, shardLength: 27, shardWidth: 10, offsetX: 0, shardColor: 0x242a31, rimColor: 0xd0d3d5 },
};

const STORY_SPECS_BY_UNIT: Readonly<Record<string, Readonly<Record<string, StorySilhouetteOverlaySpec>>>> = {
  guard: GUARD_SPECS,
  hunter: HUNTER_SPECS,
  duelist: DUELIST_SPECS,
  lancer: LANCER_SPECS,
  battlemage: BATTLEMAGE_SPECS,
  pyromancer: PYROMANCER_SPECS,
  royal: ROYAL_SPECS,
  heretic: HERETIC_SPECS,
  voidsage: VOIDSAGE_SPECS,
};

/**
 * Presentation-only silhouette scaffolding for story forms whose canonical weapon/body shape
 * cannot be represented honestly by the current CC0 human reference families.
 * Militia is intentionally omitted because its three forms already use distinct source-reference families.
 * These specs are not production assets and must never satisfy an art approval/review gate.
 */
export function getStorySilhouetteOverlaySpec(
  unitId: string,
  resolvedFormId?: string,
): StorySilhouetteOverlaySpec | undefined {
  if (!resolvedFormId) return undefined;
  return STORY_SPECS_BY_UNIT[unitId]?.[resolvedFormId];
}
