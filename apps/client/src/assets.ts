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
}

const VLEE = 'https://raw.githubusercontent.com/vlee489/AC31009-Client/71252f38c7bf4426ff84676cad517f66c3e6cb65/assets/Sprites';
const NQM = 'https://raw.githubusercontent.com/NQM765/IngeSoft1/84594e5d3da7472615660f453bdb457da13cca2f/Proyecto/Scrum%27s_Castle/Assets/Characters';

export const ART_FAMILIES: readonly ArtFamily[] = [
  {
    id: 'hero-knight', displayHeight: 190,
    idle: { key: 'hero-knight-idle', url: `${VLEE}/HeroKnight/Idle.png`, frameWidth: 231, frameHeight: 180, frames: 11 },
    run: { key: 'hero-knight-run', url: `${VLEE}/HeroKnight/Run.png`, frameWidth: 180, frameHeight: 180, frames: 8 },
    attack: { key: 'hero-knight-attack', url: `${VLEE}/HeroKnight/Attack1.png`, frameWidth: 180, frameHeight: 180, frames: 7 },
  },
  {
    id: 'hero-knight-2', displayHeight: 184,
    idle: { key: 'hero-knight-2-idle', url: `${NQM}/Hero%20Knight%202/Sprites/Idle.png`, frameWidth: 140, frameHeight: 140, frames: 11 },
    run: { key: 'hero-knight-2-run', url: `${NQM}/Hero%20Knight%202/Sprites/Run.png`, frameWidth: 140, frameHeight: 140, frames: 8 },
    attack: { key: 'hero-knight-2-attack', url: `${NQM}/Hero%20Knight%202/Sprites/Attack.png`, frameWidth: 140, frameHeight: 140, frames: 6 },
  },
  {
    id: 'fantasy-warrior', displayHeight: 188,
    idle: { key: 'fantasy-warrior-idle', url: `${NQM}/Fantasy%20Warrior/Sprites/Idle.png`, frameWidth: 162, frameHeight: 162, frames: 10 },
    run: { key: 'fantasy-warrior-run', url: `${NQM}/Fantasy%20Warrior/Sprites/Run.png`, frameWidth: 162, frameHeight: 162, frames: 8 },
    attack: { key: 'fantasy-warrior-attack', url: `${NQM}/Fantasy%20Warrior/Sprites/Attack1.png`, frameWidth: 162, frameHeight: 162, frames: 7 },
  },
  {
    id: 'wizard', displayHeight: 200,
    idle: { key: 'wizard-idle', url: `${VLEE}/WizardPack/Idle.png`, frameWidth: 231, frameHeight: 190, frames: 6 },
    run: { key: 'wizard-run', url: `${VLEE}/WizardPack/Run.png`, frameWidth: 231, frameHeight: 190, frames: 8 },
    attack: { key: 'wizard-attack', url: `${VLEE}/WizardPack/Attack1.png`, frameWidth: 231, frameHeight: 190, frames: 6 },
  },
  {
    id: 'warrior', displayHeight: 178,
    idle: { key: 'warrior-idle', url: `${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Idle.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
    run: { key: 'warrior-run', url: `${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Run.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
    attack: { key: 'warrior-attack', url: `${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Attack1.png`, frameWidth: 150, frameHeight: 150, frames: 4 },
  },
  {
    id: 'huntress', displayHeight: 182,
    idle: { key: 'huntress-idle', url: `${NQM}/Huntress/Sprites/Idle.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
    run: { key: 'huntress-run', url: `${NQM}/Huntress/Sprites/Run.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
    attack: { key: 'huntress-attack', url: `${NQM}/Huntress/Sprites/Attack1.png`, frameWidth: 150, frameHeight: 150, frames: 5 },
  },
  {
    id: 'evil-wizard', displayHeight: 190,
    idle: { key: 'evil-wizard-idle', url: `${NQM}/Evil%20Wizard/Sprites/Idle.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
    run: { key: 'evil-wizard-run', url: `${NQM}/Evil%20Wizard/Sprites/Move.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
    attack: { key: 'evil-wizard-attack', url: `${NQM}/Evil%20Wizard/Sprites/Attack.png`, frameWidth: 150, frameHeight: 150, frames: 8 },
  },
] as const;

export interface UnitArtVariant {
  readonly familyId: string;
  readonly tint: number;
  readonly displayScale?: number;
}

export const UNIT_ART: Readonly<Record<string, UnitArtVariant>> = {
  militia: { familyId: 'warrior', tint: 0xffffff },
  guard: { familyId: 'hero-knight-2', tint: 0xffffff },
  hunter: { familyId: 'huntress', tint: 0xffffff },
  duelist: { familyId: 'fantasy-warrior', tint: 0xffffff },
  lancer: { familyId: 'huntress', tint: 0xbedcff },
  battlemage: { familyId: 'wizard', tint: 0xffffff },
  pyromancer: { familyId: 'wizard', tint: 0xffa782 },
  royal: { familyId: 'hero-knight', tint: 0xffe08a, displayScale: 1.08 },
  heretic: { familyId: 'evil-wizard', tint: 0xd9a5ff },
  voidsage: { familyId: 'evil-wizard', tint: 0x8ebcff, displayScale: 1.12 },

  'enemy-raider': { familyId: 'warrior', tint: 0xff9a93 },
  'enemy-sprinter': { familyId: 'fantasy-warrior', tint: 0xffb27d },
  'enemy-spearman': { familyId: 'huntress', tint: 0xffad96 },
  'enemy-shield': { familyId: 'hero-knight-2', tint: 0xd38c83 },
  'enemy-cultist': { familyId: 'evil-wizard', tint: 0xff7373 },
  'enemy-sniper': { familyId: 'wizard', tint: 0xeeb7ff },
  'enemy-knight': { familyId: 'hero-knight', tint: 0xd78383 },
  'enemy-berserker': { familyId: 'fantasy-warrior', tint: 0xff6767, displayScale: 1.08 },
  'enemy-boss': { familyId: 'evil-wizard', tint: 0xffd36e, displayScale: 1.28 },
  'enemy-boss-iron': { familyId: 'hero-knight', tint: 0xb5c6d8, displayScale: 1.38 },
};

export const ART_BY_ID: Readonly<Record<string, ArtFamily>> = Object.fromEntries(ART_FAMILIES.map((art) => [art.id, art]));
