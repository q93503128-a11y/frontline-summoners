export interface SpriteStrip {
  readonly key: string;
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
}

export interface ArtFamily {
  readonly id: string;
  readonly idle: SpriteStrip;
  readonly run: SpriteStrip;
  readonly attack: SpriteStrip;
  readonly displayHeight: number;
  /** Zero-based sprite frame that visually represents weapon/spell contact. */
  readonly attackContactFrame: number;
}

export type AttackFxStyle = 'SLASH' | 'PIERCE' | 'BLUNT' | 'MAGIC' | 'FIRE' | 'VOID';

const LOCAL = '/assets/characters';

export const ART_FAMILIES: readonly ArtFamily[] = [
  {
    id: 'hero-knight', displayHeight: 190, attackContactFrame: 4,
    idle: { key: 'hero-knight-idle', url: `${LOCAL}/hero-knight/idle.png`, frameWidth: 180, frameHeight: 180, frames: 11 },
    run: { key: 'hero-knight-run', url: `${LOCAL}/hero-knight/run.png`, frameWidth: 180, frameHeight: 180, frames: 8 },
    attack: { key: 'hero-knight-attack', url: `${LOCAL}/hero-knight/attack.png`, frameWidth: 180, frameHeight: 180, frames: 7 },
  },
  {
    id: 'hero-knight-2', displayHeight: 184, attackContactFrame: 3,
    idle: { key: 'hero-knight-2-idle', url: `${LOCAL}/hero-knight-2/idle.png`, frameWidth: 140, frameHeight: 140, frames: 11 },
    run: { key: 'hero-knight-2-run', url: `${LOCAL}/hero-knight-2/run.png`, frameWidth: 140, frameHeight: 140, frames: 8 },
    attack: { key: 'hero-knight-2-attack', url: `${LOCAL}/hero-knight-2/attack.png`, frameWidth: 140, frameHeight: 140, frames: 6 },
  },
  {
    id: 'fantasy-warrior', displayHeight: 188, attackContactFrame: 4,
    idle: { key: 'fantasy-warrior-idle', url: `${LOCAL}/fantasy-warrior/idle.png`, frameWidth: 162, frameHeight: 162, frames: 10 },
    run: { key: 'fantasy-warrior-run', url: `${LOCAL}/fantasy-warrior/run.png`, frameWidth: 162, frameHeight: 162, frames: 8 },
    attack: { key: 'fantasy-warrior-attack', url: `${LOCAL}/fantasy-warrior/attack.png`, frameWidth: 162, frameHeight: 162, frames: 7 },
  },
  {
    id: 'wizard', displayHeight: 200, attackContactFrame: 3,
    idle: { key: 'wizard-idle', url: `${LOCAL}/wizard/idle.png`, frameWidth: 231, frameHeight: 190, frames: 6 },
    run: { key: 'wizard-run', url: `${LOCAL}/wizard/run.png`, frameWidth: 231, frameHeight: 190, frames: 8 },
    attack: { key: 'wizard-attack', url: `${LOCAL}/wizard/attack.png`, frameWidth: 231, frameHeight: 190, frames: 8 },
  },
  {
    id: 'warrior', displayHeight: 178, attackContactFrame: 2,
    idle: { key: 'warrior-idle', url: `${LOCAL}/warrior/idle.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
    run: { key: 'warrior-run', url: `${LOCAL}/warrior/run.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
    attack: { key: 'warrior-attack', url: `${LOCAL}/warrior/attack.png`, frameWidth: 150, frameHeight: 150, frames: 4 },
  },
  {
    id: 'huntress', displayHeight: 182, attackContactFrame: 3,
    idle: { key: 'huntress-idle', url: `${LOCAL}/huntress/idle.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
    run: { key: 'huntress-run', url: `${LOCAL}/huntress/run.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
    attack: { key: 'huntress-attack', url: `${LOCAL}/huntress/attack.png`, frameWidth: 150, frameHeight: 150, frames: 5 },
  },
  {
    id: 'evil-wizard', displayHeight: 190, attackContactFrame: 5,
    idle: { key: 'evil-wizard-idle', url: `${LOCAL}/evil-wizard/idle.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
    run: { key: 'evil-wizard-run', url: `${LOCAL}/evil-wizard/run.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
    attack: { key: 'evil-wizard-attack', url: `${LOCAL}/evil-wizard/attack.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
  },
] as const;

export interface UnitArtVariant {
  readonly familyId: string;
  readonly tint: number;
  readonly displayScale?: number;
  readonly attackFx: AttackFxStyle;
}

export const UNIT_ART: Readonly<Record<string, UnitArtVariant>> = {
  militia: { familyId: 'warrior', tint: 0xffffff, attackFx: 'SLASH' },
  guard: { familyId: 'hero-knight-2', tint: 0xffffff, attackFx: 'BLUNT' },
  hunter: { familyId: 'huntress', tint: 0xffffff, attackFx: 'PIERCE' },
  duelist: { familyId: 'fantasy-warrior', tint: 0xffffff, attackFx: 'SLASH' },
  lancer: { familyId: 'huntress', tint: 0xbedcff, attackFx: 'PIERCE' },
  battlemage: { familyId: 'wizard', tint: 0xffffff, attackFx: 'MAGIC' },
  pyromancer: { familyId: 'wizard', tint: 0xffa782, attackFx: 'FIRE' },
  royal: { familyId: 'hero-knight', tint: 0xffe08a, displayScale: 1.08, attackFx: 'SLASH' },
  heretic: { familyId: 'evil-wizard', tint: 0xd9a5ff, attackFx: 'VOID' },
  voidsage: { familyId: 'evil-wizard', tint: 0x8ebcff, displayScale: 1.12, attackFx: 'VOID' },

  // Canonical 33-character recruitment roster. These mappings are explicit gameplay placeholders only.
  // Production character art must replace these shared families before release; tint swaps are not accepted as final art.
  char_common_c_turnip_rider: { familyId: 'fantasy-warrior', tint: 0xb8e687, displayScale: 0.94, attackFx: 'SLASH' },
  char_common_c_tin_squire: { familyId: 'hero-knight-2', tint: 0xaeb8c2, displayScale: 0.90, attackFx: 'BLUNT' },
  char_common_c_slinger: { familyId: 'huntress', tint: 0xd6c69b, displayScale: 0.90, attackFx: 'PIERCE' },
  char_common_c_bell_crab: { familyId: 'hero-knight', tint: 0xc0a178, displayScale: 0.88, attackFx: 'BLUNT' },
  char_common_c_lantern_moth: { familyId: 'wizard', tint: 0xffd38a, displayScale: 0.88, attackFx: 'MAGIC' },

  char_common_b_lantern_witch: { familyId: 'wizard', tint: 0xffba72, attackFx: 'FIRE' },
  char_common_b_clockduck: { familyId: 'hero-knight-2', tint: 0xf3cf68, displayScale: 1.04, attackFx: 'SLASH' },
  char_common_b_coffin_merchant: { familyId: 'hero-knight', tint: 0x8e7f8c, displayScale: 1.10, attackFx: 'VOID' },
  char_common_b_moss_golem: { familyId: 'fantasy-warrior', tint: 0x789b66, displayScale: 1.20, attackFx: 'BLUNT' },
  char_common_b_ink_raven: { familyId: 'evil-wizard', tint: 0x59627e, displayScale: 0.96, attackFx: 'VOID' },

  char_common_a_glass_keeper: { familyId: 'wizard', tint: 0xe7f5ff, displayScale: 1.05, attackFx: 'MAGIC' },
  char_common_a_bonedrum: { familyId: 'evil-wizard', tint: 0xe3d5b8, displayScale: 1.08, attackFx: 'BLUNT' },
  char_common_a_paper_dragon: { familyId: 'wizard', tint: 0xf4edf0, displayScale: 1.15, attackFx: 'MAGIC' },
  char_common_a_meteor_cart: { familyId: 'hero-knight', tint: 0x9f8778, displayScale: 1.30, attackFx: 'BLUNT' },
  char_common_a_mirror_guide: { familyId: 'evil-wizard', tint: 0xd8e4f2, displayScale: 1.06, attackFx: 'VOID' },

  char_s01_elsia: { familyId: 'hero-knight', tint: 0xe8f1ff, displayScale: 1.05, attackFx: 'PIERCE' },
  char_s01_riena: { familyId: 'fantasy-warrior', tint: 0xffd8b5, displayScale: 1.02, attackFx: 'BLUNT' },
  char_s01_mireille: { familyId: 'huntress', tint: 0xcbe7ff, displayScale: 1.08, attackFx: 'PIERCE' },
  char_s01_neria: { familyId: 'hero-knight', tint: 0x8b788e, displayScale: 1.10, attackFx: 'SLASH' },
  char_s01_totoria: { familyId: 'wizard', tint: 0xf2c8ff, displayScale: 1.03, attackFx: 'MAGIC' },
  char_s01_arselia: { familyId: 'evil-wizard', tint: 0xc6d4ff, displayScale: 1.20, attackFx: 'MAGIC' },

  char_s02_barga: { familyId: 'hero-knight', tint: 0x8e806c, displayScale: 1.32, attackFx: 'BLUNT' },
  char_s02_zirka: { familyId: 'fantasy-warrior', tint: 0xd98b68, displayScale: 1.06, attackFx: 'SLASH' },
  char_s02_mogu: { familyId: 'wizard', tint: 0xa8c986, displayScale: 1.15, attackFx: 'MAGIC' },
  char_s02_gardo: { familyId: 'fantasy-warrior', tint: 0xb98b70, displayScale: 1.28, attackFx: 'BLUNT' },
  char_s02_kreik: { familyId: 'huntress', tint: 0x99e7e2, displayScale: 1.08, attackFx: 'PIERCE' },
  char_s02_gormu: { familyId: 'hero-knight', tint: 0x78906a, displayScale: 1.45, attackFx: 'BLUNT' },

  char_s03_k17: { familyId: 'warrior', tint: 0x9de8ff, displayScale: 1.04, attackFx: 'SLASH' },
  char_s03_arc_railer: { familyId: 'huntress', tint: 0x8bc9ff, displayScale: 1.22, attackFx: 'PIERCE' },
  char_s03_nana04: { familyId: 'wizard', tint: 0xa9d8ff, displayScale: 1.04, attackFx: 'MAGIC' },
  char_s03_rxomega: { familyId: 'hero-knight-2', tint: 0x9aaec0, displayScale: 1.18, attackFx: 'BLUNT' },
  char_s03_blade_hound: { familyId: 'fantasy-warrior', tint: 0xaa8cff, displayScale: 1.12, attackFx: 'SLASH' },
  char_s03_overlay_astra: { familyId: 'evil-wizard', tint: 0x78d9ff, displayScale: 1.30, attackFx: 'VOID' },

  'enemy-raider': { familyId: 'warrior', tint: 0xff9a93, attackFx: 'SLASH' },
  'enemy-sprinter': { familyId: 'fantasy-warrior', tint: 0xffb27d, attackFx: 'SLASH' },
  'enemy-spearman': { familyId: 'huntress', tint: 0xffad96, attackFx: 'PIERCE' },
  'enemy-shield': { familyId: 'hero-knight-2', tint: 0xd38c83, attackFx: 'BLUNT' },
  'enemy-cultist': { familyId: 'evil-wizard', tint: 0xff7373, attackFx: 'FIRE' },
  'enemy-sniper': { familyId: 'wizard', tint: 0xeeb7ff, attackFx: 'MAGIC' },
  'enemy-knight': { familyId: 'hero-knight', tint: 0xd78383, attackFx: 'SLASH' },
  'enemy-berserker': { familyId: 'fantasy-warrior', tint: 0xff6767, displayScale: 1.08, attackFx: 'BLUNT' },
  'enemy-boss': { familyId: 'evil-wizard', tint: 0xffd36e, displayScale: 1.28, attackFx: 'VOID' },
  'enemy-boss-iron': { familyId: 'hero-knight', tint: 0xb5c6d8, displayScale: 1.38, attackFx: 'BLUNT' },

  // Chapter 2 uses explicit temporary mappings until its production enemy sheets are authored.
  enemy_ch2_mossboar: { familyId: 'fantasy-warrior', tint: 0x6f9861, displayScale: 1.22, attackFx: 'BLUNT' },
  enemy_ch2_umbrella: { familyId: 'wizard', tint: 0x91b86e, displayScale: 0.92, attackFx: 'MAGIC' },
  enemy_ch2_vinerider: { familyId: 'huntress', tint: 0x72a866, displayScale: 1.02, attackFx: 'PIERCE' },
  enemy_ch2_seedbattery: { familyId: 'wizard', tint: 0x657b4e, displayScale: 1.08, attackFx: 'MAGIC' },
  enemy_ch2_bonewheel: { familyId: 'fantasy-warrior', tint: 0xd8cfb5, displayScale: 0.86, attackFx: 'SLASH' },
  enemy_ch2_coffinbug: { familyId: 'hero-knight-2', tint: 0x80796f, displayScale: 1.18, attackFx: 'BLUNT' },
  enemy_ch2_gravebell: { familyId: 'evil-wizard', tint: 0xa99e91, displayScale: 1.05, attackFx: 'MAGIC' },
  enemy_ch2_revivedarmor: { familyId: 'hero-knight', tint: 0x79808a, displayScale: 1.16, attackFx: 'BLUNT' },
  boss_ch2_rootwidow: { familyId: 'evil-wizard', tint: 0x638d5a, displayScale: 1.42, attackFx: 'VOID' },
  boss_ch2_funeral_king: { familyId: 'hero-knight', tint: 0x655f69, displayScale: 1.48, attackFx: 'VOID' },

  // Chapter 3 and 4 use explicit temporary mappings until production enemy sheets are authored.
  enemy_ch3_glasseye: { familyId: 'wizard', tint: 0xaed8ff, displayScale: 0.96, attackFx: 'MAGIC' },
  enemy_ch3_spellbug: { familyId: 'evil-wizard', tint: 0x9c83bd, displayScale: 0.88, attackFx: 'VOID' },
  enemy_ch3_floating_library: { familyId: 'wizard', tint: 0x8f75bd, displayScale: 1.20, attackFx: 'MAGIC' },
  enemy_ch3_torn_mirror: { familyId: 'evil-wizard', tint: 0xd5e8ef, displayScale: 1.08, attackFx: 'VOID' },
  enemy_ch3_contract_enforcer: { familyId: 'hero-knight', tint: 0x7f6882, displayScale: 1.18, attackFx: 'SLASH' },
  enemy_ch3_inkdemon: { familyId: 'evil-wizard', tint: 0x4f4268, displayScale: 1.04, attackFx: 'VOID' },
  enemy_ch3_arcane_battery: { familyId: 'wizard', tint: 0xb88de1, displayScale: 1.18, attackFx: 'MAGIC' },
  enemy_ch3_chain_demon: { familyId: 'fantasy-warrior', tint: 0x825b73, displayScale: 1.16, attackFx: 'BLUNT' },
  boss_ch3_archmagus: { familyId: 'wizard', tint: 0xc9a8ff, displayScale: 1.42, attackFx: 'MAGIC' },
  boss_ch3_belzar: { familyId: 'evil-wizard', tint: 0x6e4d79, displayScale: 1.48, attackFx: 'VOID' },

  enemy_ch4_sawbird: { familyId: 'huntress', tint: 0x9da9b3, displayScale: 0.88, attackFx: 'PIERCE' },
  enemy_ch4_magnet_spider: { familyId: 'hero-knight-2', tint: 0x788895, displayScale: 1.06, attackFx: 'BLUNT' },
  enemy_ch4_railworm: { familyId: 'wizard', tint: 0x859bad, displayScale: 1.16, attackFx: 'MAGIC' },
  enemy_ch4_furnace_golem: { familyId: 'hero-knight', tint: 0x8c705f, displayScale: 1.34, attackFx: 'FIRE' },
  enemy_ch4_folded_soldier: { familyId: 'fantasy-warrior', tint: 0xb4a4ca, displayScale: 1.02, attackFx: 'SLASH' },
  enemy_ch4_error_mass: { familyId: 'evil-wizard', tint: 0x8d73a9, displayScale: 1.12, attackFx: 'VOID' },
  enemy_ch4_void_lens: { familyId: 'wizard', tint: 0x779ac7, displayScale: 1.10, attackFx: 'VOID' },
  enemy_ch4_fusion_cavalry: { familyId: 'hero-knight', tint: 0x8f75ad, displayScale: 1.22, attackFx: 'SLASH' },
  boss_ch4_moving_throne: { familyId: 'hero-knight', tint: 0x7b8191, displayScale: 1.52, attackFx: 'BLUNT' },
  boss_ch4_zero_engine: { familyId: 'evil-wizard', tint: 0x65759e, displayScale: 1.58, attackFx: 'VOID' },

  // Permanent SPECIAL bosses remain temporary silhouettes until dedicated production sheets are authored.
  boss_sp_glutton_drake: { familyId: 'fantasy-warrior', tint: 0x9a684c, displayScale: 1.58, attackFx: 'BLUNT' },
  boss_sp_undying_night: { familyId: 'evil-wizard', tint: 0x77708b, displayScale: 1.44, attackFx: 'VOID' },
  boss_sp_glass_castle: { familyId: 'wizard', tint: 0xc7e6f4, displayScale: 1.58, attackFx: 'MAGIC' },
  boss_sp_walking_machine_castle: { familyId: 'hero-knight', tint: 0x6f7b82, displayScale: 1.65, attackFx: 'BLUNT' },
  boss_sp_unobservable: { familyId: 'evil-wizard', tint: 0x745d9c, displayScale: 1.56, attackFx: 'VOID' },
};

export const ART_BY_ID: Readonly<Record<string, ArtFamily>> = Object.fromEntries(ART_FAMILIES.map((art) => [art.id, art]));
