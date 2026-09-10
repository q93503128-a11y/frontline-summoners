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
 * export consumed by runtime art plumbing. Series 2 itself remains isolated in its own module;
 * this compatibility aggregation avoids widening unrelated production-art code during the pass.
 * All entries are source-reference PLACEHOLDER art until visually approved for production use.
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
  char_s01_elsia_f1: { familyId: 's01-elsia-f1', tint: 0xffffff, attackFx: 'PIERCE' },
  char_s01_elsia_f2: { familyId: 's01-elsia-f2', tint: 0xffffff, attackFx: 'PIERCE' },
  char_s01_elsia_f3: { familyId: 's01-elsia-f3', tint: 0xffffff, attackFx: 'PIERCE' },
  char_s01_riena_f1: { familyId: 's01-riena-f1', tint: 0xffffff, attackFx: 'BLUNT' },
  char_s01_riena_f2: { familyId: 's01-riena-f2', tint: 0xffffff, attackFx: 'BLUNT' },
  char_s01_riena_f3: { familyId: 's01-riena-f3', tint: 0xffffff, attackFx: 'BLUNT' },
  char_s01_mireille_f1: { familyId: 's01-mireille-f1', tint: 0xffffff, attackFx: 'PIERCE' },
  char_s01_mireille_f2: { familyId: 's01-mireille-f2', tint: 0xffffff, attackFx: 'PIERCE' },
  char_s01_mireille_f3: { familyId: 's01-mireille-f3', tint: 0xffffff, attackFx: 'PIERCE' },
  char_s01_neria_f1: { familyId: 's01-neria-f1', tint: 0xffffff, attackFx: 'SLASH' },
  char_s01_neria_f2: { familyId: 's01-neria-f2', tint: 0xffffff, attackFx: 'SLASH' },
  char_s01_neria_f3: { familyId: 's01-neria-f3', tint: 0xffffff, attackFx: 'SLASH' },
  char_s01_totoria_f1: { familyId: 's01-totoria-f1', tint: 0xffffff, attackFx: 'MAGIC' },
  char_s01_totoria_f2: { familyId: 's01-totoria-f2', tint: 0xffffff, attackFx: 'MAGIC' },
  char_s01_totoria_f3: { familyId: 's01-totoria-f3', tint: 0xffffff, attackFx: 'MAGIC' },
  ...SERIES_TWO_S_PLACEHOLDER_FORM_ART,
};
