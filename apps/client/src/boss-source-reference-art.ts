import { UNIT_ART, type ArtFamily, type SpriteStrip, type UnitArtVariant } from './assets.ts';

export interface BossSourceReferenceArtFamily extends ArtFamily {
  readonly knockback: SpriteStrip;
  readonly death: SpriteStrip;
}

const ROOT = '/assets/characters/boss-source-reference';
const strip = (key: string, folder: string, motion: string): SpriteStrip => ({
  key,
  url: `${ROOT}/${folder}/${motion}.png`,
  frameWidth: 128,
  frameHeight: 128,
  frames: 4,
});

/**
 * CC0 source-reference boss silhouettes.
 *
 * Pixel-Boy Ninja Adventure source revision:
 * series-ai/jam-ready-assets@e93aa129978daafda85f3c907eebc8f1807ec43f
 * ninja-adventure/2D/top-down-rpg/LICENSE.txt (CC0-1.0)
 *
 * Foozle/Lucifer source mirror revision:
 * WithinAmnesia/ARPG@9891cd33de14dab668e085599a2fe30463c7edcc
 * Each selected Lucifer pack includes its own Readme.txt declaring CC0.
 *
 * Foozle Sci-Fi Labs Mecha Boss source mirror:
 * Devs-Noobs/The-Escape@153c7e48287eb37bf0ff3fcbe4457063b723c49c
 * Foozle_2DC0008_Sci_Fi_Lab_Mecha_Boss_Plus_Drone.zip
 * The vendoring step verifies the original archive SHA-256 and its CC0 Readme before use.
 *
 * Reactorcore Core Reactor Machines:
 * https://opengameart.org/content/core-reactor-machines (published 2025-07-28, CC0)
 * The vendoring step verifies the CC0 source page and the authored sheet structure before use.
 *
 * These remain PLACEHOLDER/source-reference art. They are deliberately separate boss
 * characters rather than scaled versions of the normal humanoid enemy families.
 */
export const BOSS_SOURCE_REFERENCE_ART_FAMILIES: readonly BossSourceReferenceArtFamily[] = [
  {
    id: 'cc0-boss-void-squid',
    displayHeight: 246,
    attackContactFrame: 2,
    idle: strip('cc0-boss-void-squid-idle', 'cc0-boss-void-squid', 'idle'),
    run: strip('cc0-boss-void-squid-run', 'cc0-boss-void-squid', 'move'),
    attack: strip('cc0-boss-void-squid-attack', 'cc0-boss-void-squid', 'attack'),
    knockback: strip('cc0-boss-void-squid-hit', 'cc0-boss-void-squid', 'hit'),
    death: strip('cc0-boss-void-squid-death', 'cc0-boss-void-squid', 'death'),
  },
  {
    id: 'cc0-boss-iron-samurai',
    displayHeight: 260,
    attackContactFrame: 2,
    idle: strip('cc0-boss-iron-samurai-idle', 'cc0-boss-iron-samurai', 'idle'),
    run: strip('cc0-boss-iron-samurai-run', 'cc0-boss-iron-samurai', 'move'),
    attack: strip('cc0-boss-iron-samurai-attack', 'cc0-boss-iron-samurai', 'attack'),
    knockback: strip('cc0-boss-iron-samurai-hit', 'cc0-boss-iron-samurai', 'hit'),
    death: strip('cc0-boss-iron-samurai-death', 'cc0-boss-iron-samurai', 'death'),
  },
  {
    id: 'cc0-boss-rootwidow',
    displayHeight: 300,
    attackContactFrame: 2,
    idle: strip('cc0-boss-rootwidow-idle', 'cc0-boss-rootwidow', 'idle'),
    run: strip('cc0-boss-rootwidow-run', 'cc0-boss-rootwidow', 'move'),
    attack: strip('cc0-boss-rootwidow-attack', 'cc0-boss-rootwidow', 'attack'),
    knockback: strip('cc0-boss-rootwidow-hit', 'cc0-boss-rootwidow', 'hit'),
    death: strip('cc0-boss-rootwidow-death', 'cc0-boss-rootwidow', 'death'),
  },
  {
    id: 'cc0-boss-funeral-king',
    displayHeight: 276,
    attackContactFrame: 2,
    idle: strip('cc0-boss-funeral-king-idle', 'cc0-boss-funeral-king', 'idle'),
    run: strip('cc0-boss-funeral-king-run', 'cc0-boss-funeral-king', 'move'),
    attack: strip('cc0-boss-funeral-king-attack', 'cc0-boss-funeral-king', 'attack'),
    knockback: strip('cc0-boss-funeral-king-hit', 'cc0-boss-funeral-king', 'hit'),
    death: strip('cc0-boss-funeral-king-death', 'cc0-boss-funeral-king', 'death'),
  },
  {
    id: 'cc0-boss-archmagus',
    displayHeight: 252,
    attackContactFrame: 2,
    idle: strip('cc0-boss-archmagus-idle', 'cc0-boss-archmagus', 'idle'),
    run: strip('cc0-boss-archmagus-run', 'cc0-boss-archmagus', 'move'),
    attack: strip('cc0-boss-archmagus-attack', 'cc0-boss-archmagus', 'attack'),
    knockback: strip('cc0-boss-archmagus-hit', 'cc0-boss-archmagus', 'hit'),
    death: strip('cc0-boss-archmagus-death', 'cc0-boss-archmagus', 'death'),
  },
  {
    id: 'cc0-boss-belzar-beast',
    displayHeight: 288,
    attackContactFrame: 2,
    idle: strip('cc0-boss-belzar-beast-idle', 'cc0-boss-belzar-beast', 'idle'),
    run: strip('cc0-boss-belzar-beast-run', 'cc0-boss-belzar-beast', 'move'),
    attack: strip('cc0-boss-belzar-beast-attack', 'cc0-boss-belzar-beast', 'attack'),
    knockback: strip('cc0-boss-belzar-beast-hit', 'cc0-boss-belzar-beast', 'hit'),
    death: strip('cc0-boss-belzar-beast-death', 'cc0-boss-belzar-beast', 'death'),
  },
  {
    id: 'cc0-boss-moving-throne',
    displayHeight: 316,
    attackContactFrame: 2,
    idle: strip('cc0-boss-moving-throne-idle', 'cc0-boss-moving-throne', 'idle'),
    run: strip('cc0-boss-moving-throne-run', 'cc0-boss-moving-throne', 'move'),
    attack: strip('cc0-boss-moving-throne-attack', 'cc0-boss-moving-throne', 'attack'),
    knockback: strip('cc0-boss-moving-throne-hit', 'cc0-boss-moving-throne', 'hit'),
    death: strip('cc0-boss-moving-throne-death', 'cc0-boss-moving-throne', 'death'),
  },
  {
    id: 'cc0-boss-zero-engine',
    displayHeight: 304,
    attackContactFrame: 2,
    idle: strip('cc0-boss-zero-engine-idle', 'cc0-boss-zero-engine', 'idle'),
    run: strip('cc0-boss-zero-engine-run', 'cc0-boss-zero-engine', 'move'),
    attack: strip('cc0-boss-zero-engine-attack', 'cc0-boss-zero-engine', 'attack'),
    knockback: strip('cc0-boss-zero-engine-hit', 'cc0-boss-zero-engine', 'hit'),
    death: strip('cc0-boss-zero-engine-death', 'cc0-boss-zero-engine', 'death'),
  },
] as const;

export const BOSS_SOURCE_REFERENCE: Readonly<Record<string, UnitArtVariant>> = {
  'enemy-boss': { familyId: 'cc0-boss-void-squid', tint: 0xffffff, attackFx: 'VOID' },
  'enemy-boss-iron': { familyId: 'cc0-boss-iron-samurai', tint: 0xffffff, attackFx: 'BLUNT' },
  boss_ch2_rootwidow: { familyId: 'cc0-boss-rootwidow', tint: 0xffffff, attackFx: 'MAGIC' },
  boss_ch2_funeral_king: { familyId: 'cc0-boss-funeral-king', tint: 0xffffff, attackFx: 'VOID' },
  boss_ch3_archmagus: { familyId: 'cc0-boss-archmagus', tint: 0xffffff, attackFx: 'MAGIC' },
  boss_ch3_belzar: { familyId: 'cc0-boss-belzar-beast', tint: 0xffffff, attackFx: 'BLUNT' },
  boss_ch4_moving_throne: { familyId: 'cc0-boss-moving-throne', tint: 0xffffff, attackFx: 'BLUNT' },
  boss_ch4_zero_engine: { familyId: 'cc0-boss-zero-engine', tint: 0xffffff, attackFx: 'VOID' },
} as const;

export function installBossSourceReferenceMappings(): void {
  const mutableUnitArt = UNIT_ART as Record<string, UnitArtVariant>;
  for (const [unitId, variant] of Object.entries(BOSS_SOURCE_REFERENCE)) {
    mutableUnitArt[unitId] = variant;
  }
}
