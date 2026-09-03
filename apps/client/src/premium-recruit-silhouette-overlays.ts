export type PremiumRecruitSilhouetteShape =
  | 'STAR_LANCE'
  | 'RELIC_MAUL'
  | 'CRYSTAL_BOW'
  | 'BLACK_ROSE_KNIGHT'
  | 'PUPPET_MASTER'
  | 'STAR_PRINCESS'
  | 'MOUNTAIN_SHELL'
  | 'SCYTHE_TAIL'
  | 'SPORE_BALLOON'
  | 'SKY_JAW'
  | 'CRYSTAL_BEETLE'
  | 'WORLD_BACK'
  | 'DUAL_BLADE'
  | 'RAIL_CORE'
  | 'DRONE_OPERATOR'
  | 'BULWARK_ROBOT'
  | 'BLADE_HOUND_PREMIUM'
  | 'ASTRA_ARRAY';

export type PremiumRecruitRarity = 'S' | 'SS';

export interface PremiumRecruitSilhouetteSpec {
  readonly kind: 'PREMIUM_RECRUIT';
  readonly key: string;
  readonly shape: PremiumRecruitSilhouetteShape;
  readonly rarity: PremiumRecruitRarity;
  readonly formOrder: 1 | 2 | 3;
  readonly scale: number;
  readonly primaryColor: number;
  readonly secondaryColor: number;
  readonly accentColor: number;
  readonly attackPushMax: number;
}

interface PremiumRecruitBase {
  readonly shape: PremiumRecruitSilhouetteShape;
  readonly rarity: PremiumRecruitRarity;
  readonly scale?: number;
  readonly primaryColor: number;
  readonly secondaryColor: number;
  readonly accentColor: number;
  readonly attackPushMax?: number;
}

const PREMIUM_RECRUIT_SIGNATURES: Readonly<Record<string, PremiumRecruitBase>> = {
  char_s01_elsia: { shape: 'STAR_LANCE', rarity: 'S', primaryColor: 0xe7edf3, secondaryColor: 0x758399, accentColor: 0xd5b55f, attackPushMax: 9 },
  char_s01_riena: { shape: 'RELIC_MAUL', rarity: 'S', primaryColor: 0xf1e4dc, secondaryColor: 0x7e5263, accentColor: 0xe0b86d, attackPushMax: 7 },
  char_s01_mireille: { shape: 'CRYSTAL_BOW', rarity: 'S', primaryColor: 0xd8edf3, secondaryColor: 0x63859c, accentColor: 0x9de5ff, attackPushMax: 5 },
  char_s01_neria: { shape: 'BLACK_ROSE_KNIGHT', rarity: 'S', scale: 1.05, primaryColor: 0x4c4655, secondaryColor: 0x211f28, accentColor: 0xb34d68, attackPushMax: 6 },
  char_s01_totoria: { shape: 'PUPPET_MASTER', rarity: 'S', primaryColor: 0x725c82, secondaryColor: 0x342d3e, accentColor: 0xd8a7e8, attackPushMax: 5 },
  char_s01_arselia: { shape: 'STAR_PRINCESS', rarity: 'SS', scale: 1.10, primaryColor: 0xf4e9c8, secondaryColor: 0x6f5c86, accentColor: 0xffd96f, attackPushMax: 6 },

  char_s02_barga: { shape: 'MOUNTAIN_SHELL', rarity: 'S', scale: 1.10, primaryColor: 0x7d765f, secondaryColor: 0x47483c, accentColor: 0x9ead72, attackPushMax: 4 },
  char_s02_zirka: { shape: 'SCYTHE_TAIL', rarity: 'S', primaryColor: 0x8c6855, secondaryColor: 0x43382f, accentColor: 0xcbb48c, attackPushMax: 9 },
  char_s02_mogu: { shape: 'SPORE_BALLOON', rarity: 'S', scale: 1.06, primaryColor: 0x9b83a0, secondaryColor: 0x55485b, accentColor: 0xd5c28f, attackPushMax: 4 },
  char_s02_gardo: { shape: 'SKY_JAW', rarity: 'S', scale: 1.08, primaryColor: 0x776555, secondaryColor: 0x332e2b, accentColor: 0xe1c49a, attackPushMax: 8 },
  char_s02_kreik: { shape: 'CRYSTAL_BEETLE', rarity: 'S', primaryColor: 0x586d66, secondaryColor: 0x2f3d3b, accentColor: 0x77d6c8, attackPushMax: 5 },
  char_s02_gormu: { shape: 'WORLD_BACK', rarity: 'SS', scale: 1.18, primaryColor: 0x716a55, secondaryColor: 0x3e4137, accentColor: 0x96a36c, attackPushMax: 5 },

  char_s03_k17: { shape: 'DUAL_BLADE', rarity: 'S', primaryColor: 0x59636c, secondaryColor: 0x252b31, accentColor: 0x69e4f4, attackPushMax: 8 },
  char_s03_arc_railer: { shape: 'RAIL_CORE', rarity: 'S', scale: 1.06, primaryColor: 0x505a66, secondaryColor: 0x242a30, accentColor: 0x79e6ff, attackPushMax: 4 },
  char_s03_nana04: { shape: 'DRONE_OPERATOR', rarity: 'S', primaryColor: 0x7b8491, secondaryColor: 0x303640, accentColor: 0xe59bc8, attackPushMax: 5 },
  char_s03_rxomega: { shape: 'BULWARK_ROBOT', rarity: 'S', scale: 1.08, primaryColor: 0x66717b, secondaryColor: 0x293139, accentColor: 0x70bfe8, attackPushMax: 3 },
  char_s03_blade_hound: { shape: 'BLADE_HOUND_PREMIUM', rarity: 'S', primaryColor: 0x545e68, secondaryColor: 0x222930, accentColor: 0x82ecff, attackPushMax: 9 },
  char_s03_overlay_astra: { shape: 'ASTRA_ARRAY', rarity: 'SS', scale: 1.12, primaryColor: 0x626b7a, secondaryColor: 0x242933, accentColor: 0xb58cff, attackPushMax: 7 },
};

export const PREMIUM_RECRUIT_UNIT_IDS = Object.freeze(Object.keys(PREMIUM_RECRUIT_SIGNATURES));

function formOrderOf(unitId: string, formId?: string): 1 | 2 | 3 | undefined {
  if (!formId || !formId.startsWith(`${unitId}_f`)) return undefined;
  if (formId === `${unitId}_f1`) return 1;
  if (formId === `${unitId}_f2`) return 2;
  if (formId === `${unitId}_f3`) return 3;
  return undefined;
}

/** Presentation-only premium identity scaffolding. This never satisfies production-art review/evidence. */
export function getPremiumRecruitSilhouetteSpec(
  unitId: string,
  resolvedFormId?: string,
): PremiumRecruitSilhouetteSpec | undefined {
  const base = PREMIUM_RECRUIT_SIGNATURES[unitId];
  if (!base) return undefined;
  const formOrder = formOrderOf(unitId, resolvedFormId);
  if (!formOrder) return undefined;
  const formScale = formOrder === 1 ? 1 : formOrder === 2 ? 1.07 : 1.14;
  return {
    kind: 'PREMIUM_RECRUIT',
    key: `${unitId}-premium-f${formOrder}`,
    shape: base.shape,
    rarity: base.rarity,
    formOrder,
    scale: (base.scale ?? 1) * formScale,
    primaryColor: base.primaryColor,
    secondaryColor: base.secondaryColor,
    accentColor: base.accentColor,
    attackPushMax: base.attackPushMax ?? 5,
  };
}
