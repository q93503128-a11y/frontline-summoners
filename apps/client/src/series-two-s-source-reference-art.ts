import type { ArtFamily, SpriteStrip, UnitArtVariant } from './assets.ts';

export interface SeriesTwoSSourceReferenceArtFamily extends ArtFamily {
  readonly knockback: SpriteStrip;
  readonly death: SpriteStrip;
}

const ROOT = '/assets/characters/series-two-s-source-reference';

function strip(key: string, url: string): SpriteStrip {
  return { key, url, frameWidth: 128, frameHeight: 128, frames: 4 };
}

function family(
  id: string,
  characterSlug: string,
  form: 'f1' | 'f2' | 'f3',
  displayHeight: number,
): SeriesTwoSSourceReferenceArtFamily {
  const root = `${ROOT}/${characterSlug}/${form}`;
  return {
    id,
    displayHeight,
    attackContactFrame: 2,
    idle: strip(`${id}-idle`, `${root}/idle.png`),
    run: strip(`${id}-run`, `${root}/run.png`),
    attack: strip(`${id}-attack`, `${root}/attack.png`),
    knockback: strip(`${id}-knockback`, `${root}/hit.png`),
    death: strip(`${id}-death`, `${root}/death.png`),
  };
}

/**
 * S-rarity Series 2 source references only. Every family is assembled from authored external
 * animation frames; this module never treats the references as production-approved art.
 * Evolution readability comes from authored attack/creature variants rather than recolours,
 * AI drawing, or hand-authored kitbashing in this repository.
 */
export const SERIES_TWO_S_SOURCE_REFERENCE_ART_FAMILIES: readonly SeriesTwoSSourceReferenceArtFamily[] = [
  family('s02-barga-f1', 'barga', 'f1', 198),
  family('s02-barga-f2', 'barga', 'f2', 202),
  family('s02-barga-f3', 'barga', 'f3', 206),
  family('s02-zirka-f1', 'zirka', 'f1', 174),
  family('s02-zirka-f2', 'zirka', 'f2', 180),
  family('s02-zirka-f3', 'zirka', 'f3', 188),
  family('s02-mogu-f1', 'mogu', 'f1', 176),
  family('s02-mogu-f2', 'mogu', 'f2', 184),
  family('s02-mogu-f3', 'mogu', 'f3', 194),
  family('s02-gardo-f1', 'gardo', 'f1', 204),
  family('s02-gardo-f2', 'gardo', 'f2', 210),
  family('s02-gardo-f3', 'gardo', 'f3', 216),
  family('s02-kreik-f1', 'kreik', 'f1', 182),
  family('s02-kreik-f2', 'kreik', 'f2', 188),
  family('s02-kreik-f3', 'kreik', 'f3', 196),
];

export const SERIES_TWO_S_PLACEHOLDER_FORM_ART: Readonly<Record<string, UnitArtVariant>> = {
  char_s02_barga_f1: { familyId: 's02-barga-f1', tint: 0xffffff, attackFx: 'BLUNT' },
  char_s02_barga_f2: { familyId: 's02-barga-f2', tint: 0xffffff, attackFx: 'BLUNT' },
  char_s02_barga_f3: { familyId: 's02-barga-f3', tint: 0xffffff, attackFx: 'BLUNT' },
  char_s02_zirka_f1: { familyId: 's02-zirka-f1', tint: 0xffffff, attackFx: 'SLASH' },
  char_s02_zirka_f2: { familyId: 's02-zirka-f2', tint: 0xffffff, attackFx: 'SLASH' },
  char_s02_zirka_f3: { familyId: 's02-zirka-f3', tint: 0xffffff, attackFx: 'SLASH' },
  char_s02_mogu_f1: { familyId: 's02-mogu-f1', tint: 0xffffff, attackFx: 'MAGIC' },
  char_s02_mogu_f2: { familyId: 's02-mogu-f2', tint: 0xffffff, attackFx: 'MAGIC' },
  char_s02_mogu_f3: { familyId: 's02-mogu-f3', tint: 0xffffff, attackFx: 'MAGIC' },
  char_s02_gardo_f1: { familyId: 's02-gardo-f1', tint: 0xffffff, attackFx: 'BLUNT' },
  char_s02_gardo_f2: { familyId: 's02-gardo-f2', tint: 0xffffff, attackFx: 'BLUNT' },
  char_s02_gardo_f3: { familyId: 's02-gardo-f3', tint: 0xffffff, attackFx: 'BLUNT' },
  char_s02_kreik_f1: { familyId: 's02-kreik-f1', tint: 0xffffff, attackFx: 'MAGIC' },
  char_s02_kreik_f2: { familyId: 's02-kreik-f2', tint: 0xffffff, attackFx: 'MAGIC' },
  char_s02_kreik_f3: { familyId: 's02-kreik-f3', tint: 0xffffff, attackFx: 'MAGIC' },
};
