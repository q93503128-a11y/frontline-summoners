export type SignatureSilhouetteShape =
  | 'TURNIP_RIDER'
  | 'TIN_SQUIRE'
  | 'SLINGER'
  | 'BELL_CRAB'
  | 'LANTERN_MOTH'
  | 'LANTERN_WITCH'
  | 'CLOCK_DUCK'
  | 'COFFIN_MERCHANT'
  | 'MOSS_GOLEM'
  | 'INK_RAVEN'
  | 'GLASS_KEEPER'
  | 'BONE_DRUM'
  | 'PAPER_DRAGON'
  | 'METEOR_CART'
  | 'MIRROR_GUIDE'
  | 'HOUND'
  | 'LONG_SPEAR'
  | 'POT_SHIELD'
  | 'BLACK_FLAG'
  | 'GLASS_ROD'
  | 'BOAR'
  | 'MACE'
  | 'GOLD_MASK'
  | 'IRON_GATE'
  | 'MOSS_BOAR'
  | 'MUSHROOM'
  | 'VINE_RIDER'
  | 'SEED_CANNON'
  | 'BONE_WHEEL'
  | 'COFFIN_BUG'
  | 'GRAVE_BELL'
  | 'EMPTY_ARMOR'
  | 'ROOT_SPIDER'
  | 'FUNERAL_KING';

export interface SignatureSilhouetteOverlaySpec {
  readonly kind: 'SIGNATURE';
  readonly key: string;
  readonly shape: SignatureSilhouetteShape;
  readonly formOrder: 1 | 2 | 3;
  readonly scale: number;
  readonly primaryColor: number;
  readonly secondaryColor: number;
  readonly accentColor: number;
  readonly attackPushMax: number;
}

interface SignatureBase {
  readonly shape: SignatureSilhouetteShape;
  readonly primaryColor: number;
  readonly secondaryColor: number;
  readonly accentColor: number;
  readonly attackPushMax?: number;
}

const COMMON_SIGNATURES: Readonly<Record<string, SignatureBase>> = {
  char_common_c_turnip_rider: { shape: 'TURNIP_RIDER', primaryColor: 0xd9eee0, secondaryColor: 0x8ebf69, accentColor: 0x694e3d, attackPushMax: 7 },
  char_common_c_tin_squire: { shape: 'TIN_SQUIRE', primaryColor: 0xb9c1c8, secondaryColor: 0x737e89, accentColor: 0xe1e4e7, attackPushMax: 3 },
  char_common_c_slinger: { shape: 'SLINGER', primaryColor: 0xa78960, secondaryColor: 0x5f4935, accentColor: 0xd7c29b, attackPushMax: 8 },
  char_common_c_bell_crab: { shape: 'BELL_CRAB', primaryColor: 0xa8794f, secondaryColor: 0x6c4b38, accentColor: 0xd9b765, attackPushMax: 4 },
  char_common_c_lantern_moth: { shape: 'LANTERN_MOTH', primaryColor: 0xe7d8a4, secondaryColor: 0x6f7282, accentColor: 0xffd978, attackPushMax: 5 },
  char_common_b_lantern_witch: { shape: 'LANTERN_WITCH', primaryColor: 0x594f68, secondaryColor: 0x2f2a39, accentColor: 0xf0b55e, attackPushMax: 5 },
  char_common_b_clockduck: { shape: 'CLOCK_DUCK', primaryColor: 0xd8b858, secondaryColor: 0x6b7881, accentColor: 0xf1df95, attackPushMax: 6 },
  char_common_b_coffin_merchant: { shape: 'COFFIN_MERCHANT', primaryColor: 0x51454d, secondaryColor: 0x2f2930, accentColor: 0xb99b7a, attackPushMax: 4 },
  char_common_b_moss_golem: { shape: 'MOSS_GOLEM', primaryColor: 0x6f7f61, secondaryColor: 0x4a5543, accentColor: 0x8fb66c, attackPushMax: 3 },
  char_common_b_ink_raven: { shape: 'INK_RAVEN', primaryColor: 0x343846, secondaryColor: 0x161922, accentColor: 0x6d7896, attackPushMax: 7 },
  char_common_a_glass_keeper: { shape: 'GLASS_KEEPER', primaryColor: 0xb9d8e6, secondaryColor: 0x66849a, accentColor: 0xe8fbff, attackPushMax: 3 },
  char_common_a_bonedrum: { shape: 'BONE_DRUM', primaryColor: 0xc9bfa6, secondaryColor: 0x6f6556, accentColor: 0xf0e6cf, attackPushMax: 4 },
  char_common_a_paper_dragon: { shape: 'PAPER_DRAGON', primaryColor: 0xe8e0df, secondaryColor: 0x9a8f91, accentColor: 0xffffff, attackPushMax: 7 },
  char_common_a_meteor_cart: { shape: 'METEOR_CART', primaryColor: 0x6f655f, secondaryColor: 0x3f3a38, accentColor: 0xb9895e, attackPushMax: 5 },
  char_common_a_mirror_guide: { shape: 'MIRROR_GUIDE', primaryColor: 0x8fa7b8, secondaryColor: 0x4c5f70, accentColor: 0xdcefff, attackPushMax: 4 },
};

const ENEMY_SIGNATURES: Readonly<Record<string, SignatureBase>> = {
  'enemy-sprinter': { shape: 'HOUND', primaryColor: 0x8c5f4e, secondaryColor: 0x4c362e, accentColor: 0xd59b74, attackPushMax: 8 },
  'enemy-spearman': { shape: 'LONG_SPEAR', primaryColor: 0x705443, secondaryColor: 0x3e322b, accentColor: 0xc0c7cc, attackPushMax: 8 },
  'enemy-shield': { shape: 'POT_SHIELD', primaryColor: 0x7c7070, secondaryColor: 0x4b4344, accentColor: 0xb8aaa4, attackPushMax: 3 },
  'enemy-cultist': { shape: 'BLACK_FLAG', primaryColor: 0x3d3135, secondaryColor: 0x201a1d, accentColor: 0xb74d47, attackPushMax: 5 },
  'enemy-sniper': { shape: 'GLASS_ROD', primaryColor: 0x9cb7c9, secondaryColor: 0x596f80, accentColor: 0xe4f4ff, attackPushMax: 4 },
  'enemy-knight': { shape: 'BOAR', primaryColor: 0x786154, secondaryColor: 0x483b35, accentColor: 0xc3a58a, attackPushMax: 8 },
  'enemy-berserker': { shape: 'MACE', primaryColor: 0x5f4a43, secondaryColor: 0x302b2a, accentColor: 0xb8a79c, attackPushMax: 7 },
  'enemy-boss': { shape: 'GOLD_MASK', primaryColor: 0xb79a4e, secondaryColor: 0x55472c, accentColor: 0xf4df85, attackPushMax: 4 },
  'enemy-boss-iron': { shape: 'IRON_GATE', primaryColor: 0x6b7780, secondaryColor: 0x353d43, accentColor: 0xbac6cf, attackPushMax: 3 },
  enemy_ch2_mossboar: { shape: 'MOSS_BOAR', primaryColor: 0x677759, secondaryColor: 0x3f4938, accentColor: 0x91ad6d, attackPushMax: 8 },
  enemy_ch2_umbrella: { shape: 'MUSHROOM', primaryColor: 0x748a5d, secondaryColor: 0x4e5d41, accentColor: 0xa8c77d, attackPushMax: 3 },
  enemy_ch2_vinerider: { shape: 'VINE_RIDER', primaryColor: 0x55764e, secondaryColor: 0x354833, accentColor: 0x8fc17c, attackPushMax: 8 },
  enemy_ch2_seedbattery: { shape: 'SEED_CANNON', primaryColor: 0x596549, secondaryColor: 0x383f31, accentColor: 0x96a96b, attackPushMax: 4 },
  enemy_ch2_bonewheel: { shape: 'BONE_WHEEL', primaryColor: 0xc9c0aa, secondaryColor: 0x655f54, accentColor: 0xeee5d0, attackPushMax: 8 },
  enemy_ch2_coffinbug: { shape: 'COFFIN_BUG', primaryColor: 0x514943, secondaryColor: 0x302d2a, accentColor: 0x8c7a68, attackPushMax: 4 },
  enemy_ch2_gravebell: { shape: 'GRAVE_BELL', primaryColor: 0x777068, secondaryColor: 0x403c39, accentColor: 0xb7a892, attackPushMax: 4 },
  enemy_ch2_revivedarmor: { shape: 'EMPTY_ARMOR', primaryColor: 0x6f7477, secondaryColor: 0x393d40, accentColor: 0xaeb5b8, attackPushMax: 5 },
  boss_ch2_rootwidow: { shape: 'ROOT_SPIDER', primaryColor: 0x5c4e3d, secondaryColor: 0x332e27, accentColor: 0x78955e, attackPushMax: 6 },
  boss_ch2_funeral_king: { shape: 'FUNERAL_KING', primaryColor: 0x4e4542, secondaryColor: 0x292526, accentColor: 0xb79d69, attackPushMax: 4 },
};

export const COMMON_SIGNATURE_UNIT_IDS = Object.freeze(Object.keys(COMMON_SIGNATURES));
export const ENEMY_SIGNATURE_UNIT_IDS = Object.freeze(Object.keys(ENEMY_SIGNATURES));

function formOrderOf(formId?: string): 1 | 2 | 3 | undefined {
  if (!formId) return undefined;
  if (formId.endsWith('_f1')) return 1;
  if (formId.endsWith('_f2')) return 2;
  if (formId.endsWith('_f3')) return 3;
  return undefined;
}

/**
 * Presentation-only identity scaffolding for common recruitment units and chapter 1-2 enemies.
 * It never satisfies production-art review or evidence requirements.
 */
export function getSignatureSilhouetteOverlaySpec(
  unitId: string,
  resolvedFormId?: string,
): SignatureSilhouetteOverlaySpec | undefined {
  const common = COMMON_SIGNATURES[unitId];
  if (common) {
    const formOrder = formOrderOf(resolvedFormId);
    if (!formOrder) return undefined;
    return {
      kind: 'SIGNATURE',
      key: `${unitId}-signature-f${formOrder}`,
      shape: common.shape,
      formOrder,
      scale: formOrder === 1 ? 1 : formOrder === 2 ? 1.08 : 1.16,
      primaryColor: common.primaryColor,
      secondaryColor: common.secondaryColor,
      accentColor: common.accentColor,
      attackPushMax: common.attackPushMax ?? 4,
    };
  }

  const enemy = ENEMY_SIGNATURES[unitId];
  if (!enemy) return undefined;
  return {
    kind: 'SIGNATURE',
    key: `${unitId}-signature`,
    shape: enemy.shape,
    formOrder: 1,
    scale: unitId.startsWith('boss_') || unitId.startsWith('enemy-boss') ? 1.22 : 1,
    primaryColor: enemy.primaryColor,
    secondaryColor: enemy.secondaryColor,
    accentColor: enemy.accentColor,
    attackPushMax: enemy.attackPushMax ?? 4,
  };
}
