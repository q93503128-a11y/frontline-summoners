import type { ArtFamily, SpriteStrip } from './assets.ts';

export interface LowerRarityFreeArtFamily extends ArtFamily {
  readonly knockback?: SpriteStrip;
  readonly death?: SpriteStrip;
}

const ROOT = '/assets/characters/lower-rarity';
const strip = (key: string, url: string, frameWidth: number, frameHeight: number, frames: number): SpriteStrip => ({
  key, url, frameWidth, frameHeight, frames,
});

const clockduckF1: LowerRarityFreeArtFamily = {
  id: 'cc0-clockduck-f1',
  displayHeight: 142,
  attackContactFrame: 1,
  idle: strip('cc0-clockduck-f1-idle', `${ROOT}/cc0-clockduck-f1/idle.png`, 16, 16, 4),
  run: strip('cc0-clockduck-f1-run', `${ROOT}/cc0-clockduck-f1/move.png`, 16, 16, 4),
  attack: strip('cc0-clockduck-f1-attack', `${ROOT}/cc0-clockduck-f1/attack.png`, 16, 16, 4),
  knockback: strip('cc0-clockduck-f1-hit', `${ROOT}/cc0-clockduck-f1/hit.png`, 16, 16, 2),
  death: strip('cc0-clockduck-f1-death', `${ROOT}/cc0-clockduck-f1/death.png`, 16, 16, 3),
};

const clockduckF3: LowerRarityFreeArtFamily = {
  id: 'cc0-clockduck-f3',
  displayHeight: 168,
  attackContactFrame: 1,
  idle: strip('cc0-clockduck-f3-idle', `${ROOT}/cc0-clockduck-f3/idle.png`, 48, 48, 4),
  run: strip('cc0-clockduck-f3-run', `${ROOT}/cc0-clockduck-f3/move.png`, 48, 48, 4),
  attack: strip('cc0-clockduck-f3-attack', `${ROOT}/cc0-clockduck-f3/attack.png`, 48, 48, 3),
  knockback: strip('cc0-clockduck-f3-hit', `${ROOT}/cc0-clockduck-f3/hit.png`, 48, 48, 2),
  death: strip('cc0-clockduck-f3-death', `${ROOT}/cc0-clockduck-f3/death.png`, 48, 48, 3),
};

function ravenFamily(id: string, displayHeight: number): LowerRarityFreeArtFamily {
  return {
    id,
    displayHeight,
    attackContactFrame: 4,
    idle: strip(`${id}-idle`, `${ROOT}/${id}/idle.png`, 48, 32, 11),
    run: strip(`${id}-run`, `${ROOT}/${id}/move.png`, 48, 32, 11),
    attack: strip(`${id}-attack`, `${ROOT}/${id}/attack.png`, 48, 32, 11),
    knockback: strip(`${id}-hit`, `${ROOT}/${id}/hit.png`, 48, 32, 3),
    death: strip(`${id}-death`, `${ROOT}/${id}/death.png`, 48, 32, 11),
  };
}

function foozleFamily(id: string, displayHeight: number): LowerRarityFreeArtFamily {
  return {
    id,
    displayHeight,
    attackContactFrame: 2,
    idle: strip(`${id}-idle`, `${ROOT}/${id}/idle.png`, 256, 256, 4),
    run: strip(`${id}-run`, `${ROOT}/${id}/move.png`, 256, 256, 4),
    attack: strip(`${id}-attack`, `${ROOT}/${id}/attack.png`, 256, 256, 4),
    knockback: strip(`${id}-hit`, `${ROOT}/${id}/hit.png`, 256, 256, 4),
    death: strip(`${id}-death`, `${ROOT}/${id}/death.png`, 256, 256, 4),
  };
}

function normalizedPixelFamily(id: string, displayHeight: number): LowerRarityFreeArtFamily {
  return {
    id,
    displayHeight,
    attackContactFrame: 2,
    idle: strip(`${id}-idle`, `${ROOT}/${id}/idle.png`, 64, 64, 4),
    run: strip(`${id}-run`, `${ROOT}/${id}/move.png`, 64, 64, 4),
    attack: strip(`${id}-attack`, `${ROOT}/${id}/attack.png`, 64, 64, 4),
    knockback: strip(`${id}-hit`, `${ROOT}/${id}/hit.png`, 64, 64, 4),
    death: strip(`${id}-death`, `${ROOT}/${id}/death.png`, 64, 64, 4),
  };
}

export const LOWER_RARITY_FREE_ART_FAMILIES: readonly LowerRarityFreeArtFamily[] = [
  clockduckF1,
  clockduckF3,
  ravenFamily('cc0-ink-raven-f1', 154),
  ravenFamily('cc0-ink-raven-f2', 166),
  ravenFamily('cc0-ink-raven-f3', 178),
  foozleFamily('cc0-bell-crab-f1', 150),
  foozleFamily('cc0-bell-crab-f2', 164),
  foozleFamily('cc0-bell-crab-f3', 178),
  foozleFamily('cc0-lantern-moth-f1', 150),
  foozleFamily('cc0-lantern-moth-f2', 164),
  foozleFamily('cc0-lantern-moth-f3', 178),
  normalizedPixelFamily('cc0-tin-squire-f1', 148),
  normalizedPixelFamily('cc0-tin-squire-f2', 164),
  normalizedPixelFamily('cc0-tin-squire-f3', 180),
  normalizedPixelFamily('cc0-turnip-rider-f1', 146),
  normalizedPixelFamily('cc0-turnip-rider-f2', 162),
  normalizedPixelFamily('cc0-turnip-rider-f3', 178),
  normalizedPixelFamily('cc0-slinger-f1', 152),
  normalizedPixelFamily('cc0-slinger-f2', 168),
  normalizedPixelFamily('cc0-slinger-f3', 184),
  normalizedPixelFamily('cc0-coffin-merchant-f1', 150),
  normalizedPixelFamily('cc0-coffin-merchant-f2', 168),
  normalizedPixelFamily('cc0-coffin-merchant-f3', 186),
  normalizedPixelFamily('cc0-moss-golem-f1', 160),
  normalizedPixelFamily('cc0-moss-golem-f2', 178),
  normalizedPixelFamily('cc0-moss-golem-f3', 196),
] as const;
