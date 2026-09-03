import { ART_FAMILIES, type ArtFamily, type SpriteStrip } from './assets.ts';

export interface SourceReferenceArtFamily extends ArtFamily {
  readonly knockback?: SpriteStrip;
  readonly death?: SpriteStrip;
}

const LOCAL = '/assets/characters';
const BASE_BY_ID = new Map(ART_FAMILIES.map((family) => [family.id, family] as const));

function base(id: string): ArtFamily {
  const family = BASE_BY_ID.get(id);
  if (!family) throw new Error(`missing source-reference base art family: ${id}`);
  return family;
}

const WITH_AUTHORED_REACTIONS: readonly SourceReferenceArtFamily[] = [
  {
    ...base('hero-knight'),
    knockback: { key: 'hero-knight-knockback', url: `${LOCAL}/hero-knight/hit.png`, frameWidth: 180, frameHeight: 180, frames: 4 },
    death: { key: 'hero-knight-death', url: `${LOCAL}/hero-knight/death.png`, frameWidth: 180, frameHeight: 180, frames: 11 },
  },
  {
    ...base('hero-knight-2'),
    knockback: { key: 'hero-knight-2-knockback', url: `${LOCAL}/hero-knight-2/hit.png`, frameWidth: 140, frameHeight: 140, frames: 4 },
    death: { key: 'hero-knight-2-death', url: `${LOCAL}/hero-knight-2/death.png`, frameWidth: 140, frameHeight: 140, frames: 9 },
  },
  {
    ...base('fantasy-warrior'),
    knockback: { key: 'fantasy-warrior-knockback', url: `${LOCAL}/fantasy-warrior/hit.png`, frameWidth: 162, frameHeight: 162, frames: 3 },
    death: { key: 'fantasy-warrior-death', url: `${LOCAL}/fantasy-warrior/death.png`, frameWidth: 162, frameHeight: 162, frames: 7 },
  },
  {
    ...base('wizard'),
    knockback: { key: 'wizard-knockback', url: `${LOCAL}/wizard/hit.png`, frameWidth: 231, frameHeight: 190, frames: 4 },
    death: { key: 'wizard-death', url: `${LOCAL}/wizard/death.png`, frameWidth: 231, frameHeight: 190, frames: 7 },
  },
  {
    ...base('warrior'),
    knockback: { key: 'warrior-knockback', url: `${LOCAL}/warrior/hit.png`, frameWidth: 150, frameHeight: 150, frames: 4 },
    death: { key: 'warrior-death', url: `${LOCAL}/warrior/death.png`, frameWidth: 150, frameHeight: 150, frames: 6 },
  },
  {
    ...base('warrior-3'),
    knockback: { key: 'warrior-3-knockback', url: `${LOCAL}/warrior-3/hit.png`, frameWidth: 135, frameHeight: 135, frames: 3 },
    death: { key: 'warrior-3-death', url: `${LOCAL}/warrior-3/death.png`, frameWidth: 135, frameHeight: 135, frames: 9 },
  },
  {
    ...base('huntress'),
    knockback: { key: 'huntress-knockback', url: `${LOCAL}/huntress/hit.png`, frameWidth: 150, frameHeight: 150, frames: 3 },
    death: { key: 'huntress-death', url: `${LOCAL}/huntress/death.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
  },
  {
    ...base('evil-wizard'),
    knockback: { key: 'evil-wizard-knockback', url: `${LOCAL}/evil-wizard/hit.png`, frameWidth: 150, frameHeight: 150, frames: 4 },
    death: { key: 'evil-wizard-death', url: `${LOCAL}/evil-wizard/death.png`, frameWidth: 150, frameHeight: 150, frames: 5 },
  },
];

const WARRIOR_1: SourceReferenceArtFamily = {
  id: 'warrior-1',
  displayHeight: 176,
  attackContactFrame: 2,
  idle: { key: 'warrior-1-idle', url: `${LOCAL}/warrior-1/idle.png`, frameWidth: 184, frameHeight: 137, frames: 6 },
  run: { key: 'warrior-1-run', url: `${LOCAL}/warrior-1/run.png`, frameWidth: 184, frameHeight: 137, frames: 8 },
  attack: { key: 'warrior-1-attack', url: `${LOCAL}/warrior-1/attack.png`, frameWidth: 184, frameHeight: 137, frames: 4 },
  knockback: { key: 'warrior-1-knockback', url: `${LOCAL}/warrior-1/hit.png`, frameWidth: 184, frameHeight: 137, frames: 3 },
  death: { key: 'warrior-1-death', url: `${LOCAL}/warrior-1/death.png`, frameWidth: 184, frameHeight: 137, frames: 9 },
};

const overrides = new Map(WITH_AUTHORED_REACTIONS.map((family) => [family.id, family] as const));

export const SOURCE_REFERENCE_ART_FAMILIES: readonly SourceReferenceArtFamily[] = [
  ...ART_FAMILIES.map((family) => overrides.get(family.id) ?? family),
  WARRIOR_1,
];

export const SOURCE_REFERENCE_ART_BY_ID: Readonly<Record<string, SourceReferenceArtFamily>> = Object.fromEntries(
  SOURCE_REFERENCE_ART_FAMILIES.map((family) => [family.id, family]),
);
