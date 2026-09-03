export type LateEnemySilhouetteShape =
  | 'ARCANE_EYE'
  | 'ARCHIVE'
  | 'BEAST'
  | 'CHAIN_DEMON'
  | 'ARTILLERY'
  | 'MIRROR'
  | 'MAGE'
  | 'DEMON_NOBLE'
  | 'SAW_BIRD'
  | 'MAGNET_SPIDER'
  | 'RAIL_WORM'
  | 'FURNACE'
  | 'PAPER'
  | 'ERROR'
  | 'VOID_LENS'
  | 'CAVALRY'
  | 'THRONE'
  | 'ENGINE'
  | 'KING'
  | 'CASTLE'
  | 'ANOMALY'
  | 'VEHICLE'
  | 'GOLEM'
  | 'CARRIER'
  | 'SOUL'
  | 'FORGE'
  | 'SEAL'
  | 'RIFT'
  | 'EVENT_CREATURE'
  | 'EVENT_MACHINE';

export interface LateEnemySilhouetteOverlaySpec {
  readonly kind: 'LATE_ENEMY';
  readonly key: string;
  readonly shape: LateEnemySilhouetteShape;
  readonly variant: number;
  readonly scale: number;
  readonly primaryColor: number;
  readonly secondaryColor: number;
  readonly accentColor: number;
  readonly attackPushMax: number;
}

type LateEnemyBase = Omit<LateEnemySilhouetteOverlaySpec, 'kind' | 'key'>;

function late(
  shape: LateEnemySilhouetteShape,
  primaryColor: number,
  secondaryColor: number,
  accentColor: number,
  scale = 1,
  attackPushMax = 4,
  variant = 1,
): LateEnemyBase {
  return { shape, variant, scale, primaryColor, secondaryColor, accentColor, attackPushMax };
}

const LATE_ENEMY_SIGNATURES: Readonly<Record<string, LateEnemyBase>> = {
  // Chapter 3: arcane archive / contract-demon language.
  enemy_ch3_glasseye: late('ARCANE_EYE', 0x8bb1c7, 0x415666, 0xe7f8ff, 0.96, 4),
  enemy_ch3_spellbug: late('BEAST', 0x765b86, 0x3f3349, 0xc9a9df, 0.82, 8, 1),
  enemy_ch3_floating_library: late('ARCHIVE', 0x66574c, 0x332b27, 0xc9b382, 1.05, 3, 1),
  enemy_ch3_inkdemon: late('BEAST', 0x343242, 0x181722, 0x796e99, 0.96, 7, 2),
  enemy_ch3_chain_demon: late('CHAIN_DEMON', 0x59404d, 0x2d252b, 0xa68f96, 1.04, 7, 1),
  enemy_ch3_contract_enforcer: late('DEMON_NOBLE', 0x5d3e43, 0x302529, 0xb69072, 1.08, 5, 1),
  enemy_ch3_arcane_battery: late('ARTILLERY', 0x596b79, 0x303b44, 0xc0e5f2, 1.08, 3, 1),
  enemy_ch3_torn_mirror: late('MIRROR', 0x718796, 0x3b4750, 0xd7edfa, 1.03, 4, 1),
  boss_ch3_archmagus: late('MAGE', 0x5f5572, 0x2e2a39, 0xd2c7ef, 1.30, 4, 3),
  boss_ch3_belzar: late('DEMON_NOBLE', 0x6d3035, 0x351d22, 0xd39b72, 1.32, 7, 3),

  // Chapter 4: machine/anomaly language.
  enemy_ch4_sawbird: late('SAW_BIRD', 0x6f7780, 0x343a40, 0xc3ced6, 0.90, 8),
  enemy_ch4_magnet_spider: late('MAGNET_SPIDER', 0x667783, 0x313b42, 0xd27c7c, 1.02, 6),
  enemy_ch4_railworm: late('RAIL_WORM', 0x59636b, 0x292f34, 0x9ec7dd, 1.05, 5),
  enemy_ch4_furnace_golem: late('FURNACE', 0x5b514b, 0x302b28, 0xf08c4f, 1.20, 4, 1),
  enemy_ch4_folded_soldier: late('PAPER', 0xc9c6c3, 0x777473, 0xf1efeb, 0.98, 7),
  enemy_ch4_error_mass: late('ERROR', 0x564964, 0x24202d, 0xc176c9, 1.06, 5),
  enemy_ch4_void_lens: late('VOID_LENS', 0x3c4652, 0x1e252c, 0x9bc9e8, 1.08, 4),
  enemy_ch4_fusion_cavalry: late('CAVALRY', 0x69727a, 0x313840, 0xb880d8, 1.12, 8),
  boss_ch4_moving_throne: late('THRONE', 0x6f6455, 0x34302b, 0xc7a66a, 1.38, 3),
  boss_ch4_zero_engine: late('ENGINE', 0x404a54, 0x1f252b, 0x8dd5f2, 1.42, 5),

  // Permanent special: glutton / undead / castles / anomaly.
  enemy_sp_glutton_juvenile: late('BEAST', 0x7a5944, 0x423128, 0xc68d62, 1.12, 8, 3),
  boss_sp_glutton_drake: late('BEAST', 0x704638, 0x38251f, 0xe38b58, 1.42, 9, 4),
  boss_sp_undying_night: late('KING', 0x4f4a5c, 0x25242d, 0x9eb4d1, 1.34, 4, 2),
  boss_sp_glass_castle: late('CASTLE', 0x9abccb, 0x526d7a, 0xe3f7ff, 1.45, 2, 1),
  boss_sp_walking_machine_castle: late('CASTLE', 0x68737b, 0x32393f, 0xc59b61, 1.50, 4, 2),
  boss_sp_unobservable: late('ANOMALY', 0x4a4056, 0x211d29, 0xc07fd3, 1.38, 6, 3),

  // Permanent special: gold convoy.
  enemy_sp_gold_porter: late('CARRIER', 0x9c8143, 0x544425, 0xf0d16c, 0.93, 6, 1),
  enemy_sp_gold_cart: late('VEHICLE', 0xa3833d, 0x56431f, 0xf0c85c, 1.04, 4, 1),
  enemy_sp_gold_guard: late('GOLEM', 0x88713e, 0x473b25, 0xdab65b, 1.04, 5, 1),
  enemy_sp_gold_train: late('VEHICLE', 0x826b36, 0x42361d, 0xe2b84f, 1.20, 4, 2),
  enemy_sp_gold_vault_golem: late('GOLEM', 0x8d743c, 0x443a26, 0xe0bd61, 1.22, 5, 2),
  boss_sp_gold_carrier: late('CARRIER', 0x876b36, 0x44341f, 0xe7bd57, 1.40, 7, 3),

  // Permanent special: souls / forge.
  enemy_sp_soul_wisp: late('SOUL', 0x6b9eb7, 0x314b58, 0xc5efff, 0.78, 7, 1),
  enemy_sp_soul_armor: late('SOUL', 0x52788b, 0x2d3f49, 0x90d7ef, 1.02, 5, 2),
  enemy_sp_soul_hammer: late('SOUL', 0x627f8c, 0x30434d, 0xb2e6f5, 1.02, 7, 3),
  enemy_sp_soul_chorus: late('SOUL', 0x627f93, 0x2b3b46, 0xaedff4, 1.05, 5, 4),
  enemy_sp_soul_furnace: late('FORGE', 0x4f5961, 0x292f34, 0x70cce8, 1.12, 3, 1),
  boss_sp_soul_grand_forge: late('FORGE', 0x48515a, 0x23292f, 0x84dcf4, 1.42, 4, 2),

  // Permanent special: evolution seals.
  enemy_sp_evo_fragment: late('SEAL', 0x77678b, 0x3a3146, 0xd4b8f0, 0.84, 7, 1),
  enemy_sp_evo_seal_guard: late('SEAL', 0x655a73, 0x322c3c, 0xc5a9e3, 1.06, 5, 2),
  enemy_sp_evo_keyeater: late('BEAST', 0x5b4b69, 0x2c2633, 0xc8a9dc, 0.82, 8, 5),
  enemy_sp_evo_chain_seal: late('CHAIN_DEMON', 0x5a5067, 0x2d2934, 0xb99bd7, 1.05, 6, 2),
  enemy_sp_evo_mirror_seal: late('MIRROR', 0x706583, 0x373142, 0xd4b8eb, 1.05, 4, 2),
  enemy_sp_evo_glyph_turret: late('ARTILLERY', 0x655a78, 0x322d3d, 0xd5b6ef, 1.12, 3, 2),
  enemy_sp_evo_mid_guardian: late('SEAL', 0x5b5367, 0x2d2935, 0xc8addf, 1.24, 5, 3),
  boss_sp_evo_gatekeeper: late('SEAL', 0x50495f, 0x282531, 0xd0b5ea, 1.42, 6, 4),

  // Permanent special: rift/nightfall.
  enemy_sp_rift_shardling: late('RIFT', 0x4d5066, 0x272a36, 0xb4a6df, 0.84, 8, 1),
  enemy_sp_rift_mirror_orb: late('RIFT', 0x555d73, 0x292f3b, 0xb8c8ef, 1.00, 4, 2),
  enemy_sp_rift_observer: late('RIFT', 0x444c61, 0x222732, 0xa8c4ec, 1.12, 3, 3),
  boss_sp_rift_nightfall: late('RIFT', 0x383b4d, 0x1b1e27, 0xbf8fe0, 1.42, 6, 4),

  // Periodic/event enemies.
  enemy_ev_sand_crab: late('EVENT_CREATURE', 0xc3a469, 0x6c5738, 0xf2d28b, 0.86, 8, 1),
  enemy_ev_foodcart: late('VEHICLE', 0x8b5d48, 0x463329, 0xe3a35d, 1.07, 4, 3),
  enemy_ev_tailbeast: late('BEAST', 0x527e91, 0x2c4855, 0x8fd9e6, 1.08, 8, 6),
  enemy_ev_firework_jelly: late('EVENT_CREATURE', 0x665386, 0x312a40, 0xf3a9dc, 1.02, 4, 2),
  boss_ev_summer_kaiju: late('BEAST', 0x527b6f, 0x29433c, 0xe5b66b, 1.42, 9, 7),
  enemy_ev_ze_drone: late('EVENT_MACHINE', 0x687b87, 0x323d44, 0xaee9ff, 0.82, 8, 1),
  enemy_ev_ze_scrap_blade: late('EVENT_MACHINE', 0x6f6661, 0x393432, 0xd39c79, 0.95, 8, 2),
  enemy_ev_ze_shield: late('EVENT_MACHINE', 0x68737d, 0x343c43, 0xb9c8d3, 1.06, 3, 3),
  enemy_ev_ze_railpod: late('EVENT_MACHINE', 0x596a76, 0x2b343b, 0x9edbf2, 1.10, 3, 4),
  boss_ev_ze_testframe: late('EVENT_MACHINE', 0x536573, 0x29333a, 0xa6e4ff, 1.40, 7, 5),
};

export const LATE_ENEMY_SIGNATURE_UNIT_IDS = Object.freeze(Object.keys(LATE_ENEMY_SIGNATURES));

/** Presentation-only identity scaffolding for chapter 3-4 and special/event enemies. */
export function getLateEnemySilhouetteSpec(unitId: string): LateEnemySilhouetteOverlaySpec | undefined {
  const base = LATE_ENEMY_SIGNATURES[unitId];
  if (!base) return undefined;
  return { kind: 'LATE_ENEMY', key: `${unitId}-late-signature`, ...base };
}
