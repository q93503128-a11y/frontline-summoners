import type { ArtFamily, SpriteStrip, UnitArtVariant } from './assets.ts';
import {
  SERIES_TWO_S_PLACEHOLDER_FORM_ART,
  SERIES_TWO_S_SOURCE_REFERENCE_ART_FAMILIES,
} from './series-two-s-source-reference-art.ts';

export interface SeriesOneSSourceReferenceArtFamily extends ArtFamily {
  readonly knockback: SpriteStrip;
  readonly death: SpriteStrip;
}

const ROOT = '/assets/characters/series-one-s-source-reference';

function strip(key: string, url: string): SpriteStrip {
  return { key, url, frameWidth: 128, frameHeight: 128, frames: 4 };
}

function family(
  id: string,
  characterSlug: string,
  form: 'f1' | 'f2' | 'f3',
  displayHeight: number,
): SeriesOneSSourceReferenceArtFamily {
  const root = `${ROOT}/${characterSlug}`;
  return {
    id,
    displayHeight,
    attackContactFrame: 2,
    idle: strip(`${id}-idle`, `${root}/idle.png`),
    run: strip(`${id}-run`, `${root}/run.png`),
    attack: strip(`${id}-attack`, `${root}/attack-${form}.png`),
    knockback: strip(`${id}-knockback`, `${root}/hit.png`),
    death: strip(`${id}-death`, `${root}/death.png`),
  };
}

/**
 * S-rarity Series 1 source references plus the Series 2 S registry folded into the legacy
 * export consumed by runtime art plumbing. The generated Series 1 reference sheets remain
 * available for review, but their assembled body/weapon parts are not live-authoritative:
 * the deployed battle exposed detached/oversized parts at gameplay scale. Until production
 * art passes visual review, Series 1 forms use coherent single-character vendored families.
 */
export const SERIES_ONE_S_SOURCE_REFERENCE_ART_FAMILIES: readonly SeriesOneSSourceReferenceArtFamily[] = [
  family('s01-elsia-f1', 'elsia', 'f1', 194),
  family('s01-elsia-f2', 'elsia', 'f2', 198),
  family('s01-elsia-f3', 'elsia', 'f3', 202),
  family('s01-riena-f1', 'riena', 'f1', 194),
  family('s01-riena-f2', 'riena', 'f2', 198),
  family('s01-riena-f3', 'riena', 'f3', 202),
  family('s01-mireille-f1', 'mireille', 'f1', 190),
  family('s01-mireille-f2', 'mireille', 'f2', 194),
  family('s01-mireille-f3', 'mireille', 'f3', 198),
  family('s01-neria-f1', 'neria', 'f1', 198),
  family('s01-neria-f2', 'neria', 'f2', 202),
  family('s01-neria-f3', 'neria', 'f3', 206),
  family('s01-totoria-f1', 'totoria', 'f1', 196),
  family('s01-totoria-f2', 'totoria', 'f2', 196),
  family('s01-totoria-f3', 'totoria', 'f3', 196),
  ...SERIES_TWO_S_SOURCE_REFERENCE_ART_FAMILIES,
];

export const SERIES_ONE_S_PLACEHOLDER_FORM_ART: Readonly<Record<string, UnitArtVariant>> = {
  char_s01_elsia_f1: { familyId: 'hero-knight-2', tint: 0xe8f1ff, attackFx: 'PIERCE' },
  char_s01_elsia_f2: { familyId: 'hero-knight', tint: 0xe8f1ff, displayScale: 1.02, attackFx: 'PIERCE' },
  char_s01_elsia_f3: { familyId: 'king-2', tint: 0xe8f1ff, displayScale: 1.04, attackFx: 'PIERCE' },
  char_s01_riena_f1: { familyId: 'fantasy-warrior', tint: 0xffd8b5, attackFx: 'BLUNT' },
  char_s01_riena_f2: { familyId: 'warrior-1', tint: 0xffd8b5, displayScale: 1.02, attackFx: 'BLUNT' },
  char_s01_riena_f3: { familyId: 'martial-hero-2', tint: 0xffd8b5, displayScale: 1.04, attackFx: 'BLUNT' },
  char_s01_mireille_f1: { familyId: 'huntress', tint: 0xcbe7ff, attackFx: 'PIERCE' },
  char_s01_mireille_f2: { familyId: 'huntress-2', tint: 0xcbe7ff, displayScale: 1.02, attackFx: 'PIERCE' },
  char_s01_mireille_f3: { familyId: 'huntress', tint: 0xaed9ff, displayScale: 1.08, attackFx: 'PIERCE' },
  char_s01_neria_f1: { familyId: 'warrior', tint: 0x8b788e, attackFx: 'SLASH' },
  char_s01_neria_f2: { familyId: 'hero-knight-2', tint: 0x8b788e, displayScale: 1.03, attackFx: 'SLASH' },
  char_s01_neria_f3: { familyId: 'hero-knight', tint: 0x8b788e, displayScale: 1.05, attackFx: 'SLASH' },
  char_s01_totoria_f1: { familyId: 'wizard', tint: 0xf2c8ff, attackFx: 'MAGIC' },
  char_s01_totoria_f2: { familyId: 'evil-wizard', tint: 0xf2c8ff, displayScale: 1.02, attackFx: 'MAGIC' },
  char_s01_totoria_f3: { familyId: 'evil-wizard-2', tint: 0xf2c8ff, displayScale: 1.04, attackFx: 'MAGIC' },
  ...SERIES_TWO_S_PLACEHOLDER_FORM_ART,
};
