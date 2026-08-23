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
    attack: { key: 'wizard-attack', url: `${LOCAL}/wizard/attack.png`, frameWidth: 231, frameHeight: 190, frames: 6 },
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
};

export const ART_BY_ID: Readonly<Record<string, ArtFamily>> = Object.fromEntries(ART_FAMILIES.map((art) => [art.id, art]));
