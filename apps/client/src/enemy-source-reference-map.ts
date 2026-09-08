import { UNIT_ART, type UnitArtVariant } from './assets.ts';

/**
 * Normal-enemy source-reference assignments.
 *
 * These intentionally reuse already-vendored CC0 silhouettes instead of tinting the old
 * human placeholder families. No entry is production-approved; this only gives each
 * chapter enemy a deliberate readable silhouette while final production art is pending.
 */
export const NORMAL_ENEMY_SOURCE_REFERENCE: Readonly<Record<string, UnitArtVariant>> = {
  'enemy-raider': { familyId: 'cc0-mirror-guide-f1', tint: 0xffffff, attackFx: 'SLASH' },
  'enemy-sprinter': { familyId: 'cc0-slinger-f2', tint: 0xffffff, attackFx: 'SLASH' },
  'enemy-spearman': { familyId: 'cc0-slinger-f1', tint: 0xffffff, attackFx: 'PIERCE' },
  'enemy-shield': { familyId: 'cc0-slinger-f3', tint: 0xffffff, attackFx: 'BLUNT' },
  'enemy-cultist': { familyId: 'cc0-bonedrum-f3', tint: 0xffffff, attackFx: 'FIRE' },
  'enemy-sniper': { familyId: 'cc0-mirror-guide-f2', tint: 0xffffff, attackFx: 'MAGIC' },
  'enemy-knight': { familyId: 'cc0-moss-golem-f3', tint: 0xffffff, displayScale: 1.08, attackFx: 'SLASH' },
  'enemy-berserker': { familyId: 'cc0-tin-squire-f3', tint: 0xffffff, displayScale: 1.08, attackFx: 'BLUNT' },

  enemy_ch2_mossboar: { familyId: 'cc0-moss-golem-f1', tint: 0xffffff, displayScale: 1.22, attackFx: 'BLUNT' },
  enemy_ch2_umbrella: { familyId: 'cc0-coffin-merchant-f1', tint: 0xffffff, displayScale: 0.92, attackFx: 'MAGIC' },
  enemy_ch2_vinerider: { familyId: 'cc0-moss-golem-f2', tint: 0xffffff, displayScale: 1.02, attackFx: 'PIERCE' },
  enemy_ch2_seedbattery: { familyId: 'cc0-glass-keeper-f3', tint: 0xffffff, displayScale: 1.08, attackFx: 'MAGIC' },
  enemy_ch2_bonewheel: { familyId: 'cc0-meteor-cart-f1', tint: 0xffffff, displayScale: 0.86, attackFx: 'SLASH' },
  enemy_ch2_coffinbug: { familyId: 'cc0-bonedrum-f1', tint: 0xffffff, displayScale: 1.18, attackFx: 'BLUNT' },
  enemy_ch2_gravebell: { familyId: 'cc0-coffin-merchant-f2', tint: 0xffffff, displayScale: 1.05, attackFx: 'MAGIC' },
  enemy_ch2_revivedarmor: { familyId: 'cc0-tin-squire-f2', tint: 0xffffff, displayScale: 1.16, attackFx: 'BLUNT' },

  enemy_ch3_glasseye: { familyId: 'cc0-glass-keeper-f1', tint: 0xffffff, displayScale: 0.96, attackFx: 'MAGIC' },
  enemy_ch3_spellbug: { familyId: 'cc0-bonedrum-f2', tint: 0xffffff, displayScale: 0.88, attackFx: 'VOID' },
  enemy_ch3_floating_library: { familyId: 'cc0-paper-dragon-f1', tint: 0xffffff, displayScale: 1.20, attackFx: 'MAGIC' },
  enemy_ch3_torn_mirror: { familyId: 'cc0-mirror-guide-f3', tint: 0xffffff, displayScale: 1.08, attackFx: 'VOID' },
  enemy_ch3_contract_enforcer: { familyId: 'cc0-tin-squire-f1', tint: 0xffffff, displayScale: 1.18, attackFx: 'SLASH' },
  enemy_ch3_inkdemon: { familyId: 'cc0-ink-raven-f3', tint: 0xffffff, displayScale: 1.04, attackFx: 'VOID' },
  enemy_ch3_arcane_battery: { familyId: 'cc0-clockduck-f3', tint: 0xffffff, displayScale: 1.18, attackFx: 'MAGIC' },
  enemy_ch3_chain_demon: { familyId: 'cc0-coffin-merchant-f3', tint: 0xffffff, displayScale: 1.16, attackFx: 'BLUNT' },

  enemy_ch4_sawbird: { familyId: 'cc0-paper-dragon-f3', tint: 0xffffff, displayScale: 0.88, attackFx: 'PIERCE' },
  enemy_ch4_magnet_spider: { familyId: 'cc0-bell-crab-f3', tint: 0xffffff, displayScale: 1.06, attackFx: 'BLUNT' },
  enemy_ch4_railworm: { familyId: 'cc0-turnip-rider-f2', tint: 0xffffff, displayScale: 1.16, attackFx: 'MAGIC' },
  enemy_ch4_furnace_golem: { familyId: 'cc0-meteor-cart-f3', tint: 0xffffff, displayScale: 1.34, attackFx: 'FIRE' },
  enemy_ch4_folded_soldier: { familyId: 'cc0-turnip-rider-f1', tint: 0xffffff, displayScale: 1.02, attackFx: 'SLASH' },
  enemy_ch4_error_mass: { familyId: 'cc0-meteor-cart-f2', tint: 0xffffff, displayScale: 1.12, attackFx: 'VOID' },
  enemy_ch4_void_lens: { familyId: 'cc0-lantern-moth-f3', tint: 0xffffff, displayScale: 1.10, attackFx: 'VOID' },
  enemy_ch4_fusion_cavalry: { familyId: 'cc0-turnip-rider-f3', tint: 0xffffff, displayScale: 1.22, attackFx: 'SLASH' },
} as const;

export const NORMAL_ENEMY_SOURCE_REFERENCE_IDS = Object.keys(NORMAL_ENEMY_SOURCE_REFERENCE) as readonly string[];

export function installNormalEnemySourceReferenceMappings(): void {
  const mutableUnitArt = UNIT_ART as Record<string, UnitArtVariant>;
  for (const [unitId, variant] of Object.entries(NORMAL_ENEMY_SOURCE_REFERENCE)) {
    mutableUnitArt[unitId] = variant;
  }
}
