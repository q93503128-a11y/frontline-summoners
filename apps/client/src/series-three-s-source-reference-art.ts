import type { ArtFamily, SpriteStrip, UnitArtVariant } from './assets.ts';

export interface SeriesThreeSSourceReferenceArtFamily extends ArtFamily {
  readonly knockback: SpriteStrip;
  readonly death: SpriteStrip;
}

const ROOT = '/assets/characters/series-three-s';

function strip(key: string, characterSlug: string, motion: string): SpriteStrip {
  return {
    key,
    url: `${ROOT}/${characterSlug}/${motion}.png`,
    frameWidth: 128,
    frameHeight: 128,
    frames: 4,
  };
}

function family(
  id: string,
  characterSlug: string,
  displayHeight: number,
): SeriesThreeSSourceReferenceArtFamily {
  return {
    id,
    displayHeight,
    attackContactFrame: 2,
    idle: strip(`${id}-idle`, characterSlug, 'idle'),
    run: strip(`${id}-run`, characterSlug, 'move'),
    attack: strip(`${id}-attack`, characterSlug, 'attack'),
    knockback: strip(`${id}-knockback`, characterSlug, 'hit'),
    death: strip(`${id}-death`, characterSlug, 'death'),
  };
}

/**
 * Series 3 S-rarity mechanical recruits use complete authored CC0 droid characters.
 * They intentionally do not share a humanoid fantasy family and are never recoloured or
 * assembled from runtime parts. Form progression changes presentation scale while keeping the
 * recruit's authored silhouette stable until reviewed production evolution art replaces it.
 */
export const SERIES_THREE_S_SOURCE_REFERENCE_ART_FAMILIES: readonly SeriesThreeSSourceReferenceArtFamily[] = [
  family('s03-k17', 'k17', 218),
  family('s03-arc-railer', 'arc-railer', 230),
  family('s03-rxomega', 'rxomega', 244),
];

export const SERIES_THREE_S_PLACEHOLDER_FORM_ART: Readonly<Record<string, UnitArtVariant>> = {
  char_s03_k17_f1: { familyId: 's03-k17', tint: 0xffffff, displayScale: 0.98, attackFx: 'SLASH' },
  char_s03_k17_f2: { familyId: 's03-k17', tint: 0xffffff, displayScale: 1.06, attackFx: 'SLASH' },
  char_s03_k17_f3: { familyId: 's03-k17', tint: 0xffffff, displayScale: 1.14, attackFx: 'SLASH' },
  char_s03_arc_railer_f1: { familyId: 's03-arc-railer', tint: 0xffffff, displayScale: 1.02, attackFx: 'PIERCE' },
  char_s03_arc_railer_f2: { familyId: 's03-arc-railer', tint: 0xffffff, displayScale: 1.10, attackFx: 'PIERCE' },
  char_s03_arc_railer_f3: { familyId: 's03-arc-railer', tint: 0xffffff, displayScale: 1.18, attackFx: 'PIERCE' },
  char_s03_rxomega_f1: { familyId: 's03-rxomega', tint: 0xffffff, displayScale: 1.04, attackFx: 'BLUNT' },
  char_s03_rxomega_f2: { familyId: 's03-rxomega', tint: 0xffffff, displayScale: 1.12, attackFx: 'BLUNT' },
  char_s03_rxomega_f3: { familyId: 's03-rxomega', tint: 0xffffff, displayScale: 1.20, attackFx: 'BLUNT' },
};
