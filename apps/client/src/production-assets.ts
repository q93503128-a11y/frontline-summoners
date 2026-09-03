import { getActiveVisualFormId } from './active-visual-forms.ts';
import { UNIT_ART, type ArtFamily, type AttackFxStyle, type SpriteStrip, type UnitArtVariant } from './assets.ts';
import { EVOLUTION_FORMS } from './character-growth.ts';
import { ALL_PLAYER_SLOTS, ALL_STAGES, ENEMIES } from './prototype.ts';
import { SOURCE_REFERENCE_ART_BY_ID, SOURCE_REFERENCE_ART_FAMILIES } from './source-reference-art.ts';

export const PRODUCTION_ASSET_STATUSES = ['AWAITING_ART', 'READY_FOR_REVIEW', 'APPROVED'] as const;
export type ProductionAssetStatus = (typeof PRODUCTION_ASSET_STATUSES)[number];

export interface RuntimeArtFamily extends ArtFamily {
  /** Production or source-reference natural knockback motion when an authored strip exists. */
  readonly knockback?: SpriteStrip;
  /** Production or source-reference death motion when an authored strip exists. */
  readonly death?: SpriteStrip;
}

export interface ResolvedUnitArt {
  readonly family: RuntimeArtFamily;
  readonly tint: number;
  readonly displayScale: number;
  readonly attackFx: AttackFxStyle;
  readonly source: 'PRODUCTION' | 'PLACEHOLDER';
  readonly productionAssetId?: string;
  readonly resolvedFormId?: string;
}

export type ProductionUnitKind = 'PLAYER_FORM' | 'ENEMY' | 'BOSS';

export interface ProductionUnitVisualRequirement {
  readonly assetId: string;
  readonly kind: ProductionUnitKind;
  readonly unitId: string;
  readonly formId?: string;
  readonly displayName: string;
  readonly rootUrl: string;
  readonly requiredMotions: readonly ['idle', 'move', 'attack', 'knockback', 'death'];
}

export interface ProductionBattlefieldRequirement {
  readonly assetId: string;
  readonly themeId: string;
  readonly rootUrl: string;
}

export interface ProductionAudioRequirement {
  readonly assetId: string;
  readonly bus: 'MUSIC' | 'BATTLE_SFX' | 'UI_SFX' | 'AMBIENCE';
  readonly rootUrl: string;
}

export interface ProductionReviewReservation {
  readonly assetId: string;
  readonly status: ProductionAssetStatus;
  readonly note: string;
}

export interface ProductionUnitArtCandidate {
  readonly assetId: string;
  readonly status: Exclude<ProductionAssetStatus, 'AWAITING_ART'>;
  readonly unitId: string;
  readonly formId?: string;
  readonly family: RuntimeArtFamily;
  readonly tint?: number;
  readonly displayScale?: number;
  readonly attackFx: AttackFxStyle;
}

const REQUIRED_MOTIONS = ['idle', 'move', 'attack', 'knockback', 'death'] as const;
const PLAYER_IDS = new Set(ALL_PLAYER_SLOTS.map((slot) => slot.slotId));
const ENEMY_IDS = new Set(ENEMIES.map((enemy) => enemy.definition.id));
const FORM_BY_ID = new Map(EVOLUTION_FORMS.map((form) => [form.formId, form] as const));
const F1_FORM_BY_CHARACTER = new Map(
  EVOLUTION_FORMS.filter((form) => form.formOrder === 1).map((form) => [form.characterId, form.formId] as const),
);

/**
 * Source-reference-only form silhouettes used while production art remains unapproved.
 * These entries must never be promoted to production evidence; they only let the runtime
 * preserve evolution-form readability during the art pass.
 */
const PLACEHOLDER_PLAYER_FORM_ART: Readonly<Record<string, UnitArtVariant>> = {
  militia_f1: { familyId: 'warrior-3', tint: 0xffffff, attackFx: 'SLASH' },
  militia_f2: { familyId: 'hero-knight-2', tint: 0xffffff, attackFx: 'SLASH' },
  militia_f3: { familyId: 'warrior-1', tint: 0xffffff, displayScale: 1.04, attackFx: 'SLASH' },
};

function productionUnitRoot(unitId: string, formId?: string): string {
  return formId
    ? `/assets/production/units/${unitId}/${formId}`
    : `/assets/production/units/${unitId}`;
}

export const PRODUCTION_PLAYER_FORM_REQUIREMENTS: readonly ProductionUnitVisualRequirement[] = EVOLUTION_FORMS.map((form) => ({
  assetId: `unit:${form.characterId}:${form.formId}`,
  kind: 'PLAYER_FORM',
  unitId: form.characterId,
  formId: form.formId,
  displayName: form.name,
  rootUrl: productionUnitRoot(form.characterId, form.formId),
  requiredMotions: REQUIRED_MOTIONS,
}));

export const PRODUCTION_ENEMY_REQUIREMENTS: readonly ProductionUnitVisualRequirement[] = ENEMIES.map((enemy) => ({
  assetId: `unit:${enemy.definition.id}`,
  kind: (enemy.definition.combatTags ?? []).includes('BOSS') ? 'BOSS' : 'ENEMY',
  unitId: enemy.definition.id,
  displayName: enemy.displayName,
  rootUrl: productionUnitRoot(enemy.definition.id),
  requiredMotions: REQUIRED_MOTIONS,
}));

export const PRODUCTION_UNIT_REQUIREMENTS: readonly ProductionUnitVisualRequirement[] = [
  ...PRODUCTION_PLAYER_FORM_REQUIREMENTS,
  ...PRODUCTION_ENEMY_REQUIREMENTS,
];

const BATTLEFIELD_THEMES = [...new Set(ALL_STAGES.map((stage) => stage.theme))].sort();
export const PRODUCTION_BATTLEFIELD_REQUIREMENTS: readonly ProductionBattlefieldRequirement[] = BATTLEFIELD_THEMES.map((themeId) => ({
  assetId: `battlefield:${themeId}`,
  themeId,
  rootUrl: `/assets/production/battlefields/${themeId}`,
}));

export const PRODUCTION_AUDIO_REQUIREMENTS: readonly ProductionAudioRequirement[] = [
  { assetId: 'music:menu', bus: 'MUSIC', rootUrl: '/assets/production/audio/music/menu' },
  { assetId: 'music:chapter-01', bus: 'MUSIC', rootUrl: '/assets/production/audio/music/chapter-01' },
  { assetId: 'music:chapter-02', bus: 'MUSIC', rootUrl: '/assets/production/audio/music/chapter-02' },
  { assetId: 'music:chapter-03', bus: 'MUSIC', rootUrl: '/assets/production/audio/music/chapter-03' },
  { assetId: 'music:chapter-04', bus: 'MUSIC', rootUrl: '/assets/production/audio/music/chapter-04' },
  { assetId: 'music:special-resource', bus: 'MUSIC', rootUrl: '/assets/production/audio/music/special-resource' },
  { assetId: 'music:special-boss', bus: 'MUSIC', rootUrl: '/assets/production/audio/music/special-boss' },
  { assetId: 'music:pvp', bus: 'MUSIC', rootUrl: '/assets/production/audio/music/pvp' },
  { assetId: 'sfx:battle-core', bus: 'BATTLE_SFX', rootUrl: '/assets/production/audio/sfx/battle-core' },
  { assetId: 'sfx:ui-core', bus: 'UI_SFX', rootUrl: '/assets/production/audio/sfx/ui-core' },
  { assetId: 'ambience:battlefield', bus: 'AMBIENCE', rootUrl: '/assets/production/audio/ambience/battlefield' },
] as const;

function requirementIdForPlayerForm(characterId: string, formOrder: 1 | 2 | 3): string {
  const form = EVOLUTION_FORMS.find((candidate) => candidate.characterId === characterId && candidate.formOrder === formOrder);
  if (!form) throw new Error(`missing canonical evolution form for production reservation: ${characterId} F${formOrder}`);
  return `unit:${characterId}:${form.formId}`;
}

const firstBattlefieldTheme = ALL_STAGES[0]?.theme;
if (!firstBattlefieldTheme) throw new Error('production asset contract requires at least one battlefield theme');

/**
 * First production vertical slice. These are reservations only: they do not preload files and do not change runtime art.
 * Moving an item to APPROVED requires a real reviewed asset entry in PRODUCTION_UNIT_ART_CANDIDATES or its future
 * battlefield/audio manifest counterpart.
 */
export const PRODUCTION_VERTICAL_SLICE: readonly ProductionReviewReservation[] = [
  { assetId: requirementIdForPlayerForm('militia', 1), status: 'AWAITING_ART', note: '스토리 대표 F1 · 작은 전투 실루엣 기준' },
  { assetId: requirementIdForPlayerForm('militia', 2), status: 'AWAITING_ART', note: '스토리 대표 F2 · 진화 구조 차이 검증' },
  { assetId: requirementIdForPlayerForm('militia', 3), status: 'AWAITING_ART', note: '스토리 대표 F3 · 최종형 실루엣 검증' },
  { assetId: 'unit:enemy-raider', status: 'AWAITING_ART', note: '일반 적 식별성 기준' },
  { assetId: 'unit:enemy-boss', status: 'AWAITING_ART', note: '1장 보스급 스케일·경고 연계 기준' },
  { assetId: `battlefield:${firstBattlefieldTheme}`, status: 'AWAITING_ART', note: '첫 전장 배경·명도 대비 기준' },
  { assetId: 'music:chapter-01', status: 'AWAITING_ART', note: '1장 BGM 및 전투 오디오 버스 기준' },
  { assetId: 'sfx:battle-core', status: 'AWAITING_ART', note: 'contact 동기화 공격·거점·생산 SFX 기준' },
] as const;

/**
 * Reviewed production unit art enters here. Intentionally empty until actual files exist and have been reviewed.
 * READY_FOR_REVIEW candidates may exist in the future but are never runtime-authoritative.
 */
export const PRODUCTION_UNIT_ART_CANDIDATES: readonly ProductionUnitArtCandidate[] = [];

function allFamilyStrips(family: RuntimeArtFamily): readonly SpriteStrip[] {
  return [family.idle, family.run, family.attack, ...(family.knockback ? [family.knockback] : []), ...(family.death ? [family.death] : [])];
}

function assertProductionFamily(candidate: ProductionUnitArtCandidate): void {
  if (candidate.status !== 'APPROVED') return;
  if (!candidate.family.knockback || !candidate.family.death) {
    throw new Error(`approved production art must provide KB and Death strips: ${candidate.assetId}`);
  }
  if (!Number.isInteger(candidate.family.attackContactFrame)
    || candidate.family.attackContactFrame < 0
    || candidate.family.attackContactFrame >= candidate.family.attack.frames) {
    throw new Error(`invalid production attack contact frame: ${candidate.assetId}`);
  }
  for (const strip of allFamilyStrips(candidate.family)) {
    if (!strip.url.startsWith('/assets/production/')) throw new Error(`production strip must use /assets/production/: ${candidate.assetId}`);
    if (strip.frameWidth <= 0 || strip.frameHeight <= 0 || strip.frames <= 0) throw new Error(`invalid production strip metadata: ${candidate.assetId}`);
  }
}

function validateProductionManifest(): void {
  if (new Set(PRODUCTION_UNIT_REQUIREMENTS.map((requirement) => requirement.assetId)).size !== PRODUCTION_UNIT_REQUIREMENTS.length) {
    throw new Error('production unit requirements must have unique asset ids');
  }
  if (PRODUCTION_PLAYER_FORM_REQUIREMENTS.length !== EVOLUTION_FORMS.length) {
    throw new Error('production player art requirements must cover every canonical evolution form');
  }
  if (new Set(PRODUCTION_PLAYER_FORM_REQUIREMENTS.map((requirement) => requirement.unitId)).size !== ALL_PLAYER_SLOTS.length) {
    throw new Error('production player art requirements must cover every canonical player character');
  }
  const candidateKeys = new Set<string>();
  for (const candidate of PRODUCTION_UNIT_ART_CANDIDATES) {
    const targetKey = `${candidate.unitId}:${candidate.formId ?? ''}`;
    if (candidateKeys.has(targetKey)) throw new Error(`duplicate production art candidate target: ${targetKey}`);
    candidateKeys.add(targetKey);
    if (candidate.formId !== undefined) {
      const form = FORM_BY_ID.get(candidate.formId);
      if (!form || form.characterId !== candidate.unitId) throw new Error(`production form target is not canonical: ${candidate.assetId}`);
    } else if (!ENEMY_IDS.has(candidate.unitId)) {
      throw new Error(`production art without formId must target a canonical enemy: ${candidate.assetId}`);
    }
    assertProductionFamily(candidate);
  }
  const knownRequirementIds = new Set([
    ...PRODUCTION_UNIT_REQUIREMENTS.map((entry) => entry.assetId),
    ...PRODUCTION_BATTLEFIELD_REQUIREMENTS.map((entry) => entry.assetId),
    ...PRODUCTION_AUDIO_REQUIREMENTS.map((entry) => entry.assetId),
  ]);
  for (const reservation of PRODUCTION_VERTICAL_SLICE) {
    if (!knownRequirementIds.has(reservation.assetId)) throw new Error(`vertical-slice reservation references unknown production asset: ${reservation.assetId}`);
    if (reservation.status === 'APPROVED') throw new Error(`reservation cannot claim APPROVED without an actual manifest asset: ${reservation.assetId}`);
  }
}

validateProductionManifest();

function approvedCandidate(unitId: string, formId?: string): ProductionUnitArtCandidate | undefined {
  return PRODUCTION_UNIT_ART_CANDIDATES.find((candidate) =>
    candidate.status === 'APPROVED'
    && candidate.unitId === unitId
    && candidate.formId === formId,
  );
}

export function resolveUnitArt(unitId: string, selectedFormId?: string): ResolvedUnitArt {
  const resolvedFormId = PLAYER_IDS.has(unitId)
    ? (selectedFormId ?? getActiveVisualFormId(unitId) ?? F1_FORM_BY_CHARACTER.get(unitId))
    : undefined;
  const production = approvedCandidate(unitId, resolvedFormId);
  if (production) {
    return {
      family: production.family,
      tint: production.tint ?? 0xffffff,
      displayScale: production.displayScale ?? 1,
      attackFx: production.attackFx,
      source: 'PRODUCTION',
      productionAssetId: production.assetId,
      ...(resolvedFormId === undefined ? {} : { resolvedFormId }),
    };
  }

  const placeholder = (resolvedFormId === undefined ? undefined : PLACEHOLDER_PLAYER_FORM_ART[resolvedFormId])
    ?? UNIT_ART[unitId]
    ?? { familyId: 'warrior', tint: 0xffffff, attackFx: 'SLASH' as const };
  const family = SOURCE_REFERENCE_ART_BY_ID[placeholder.familyId] ?? SOURCE_REFERENCE_ART_FAMILIES[0]!;
  return {
    family,
    tint: placeholder.tint,
    displayScale: placeholder.displayScale ?? 1,
    attackFx: placeholder.attackFx,
    source: 'PLACEHOLDER',
    ...(resolvedFormId === undefined ? {} : { resolvedFormId }),
  };
}

export function getRuntimeArtFamilies(): readonly RuntimeArtFamily[] {
  const families = new Map<string, RuntimeArtFamily>(SOURCE_REFERENCE_ART_FAMILIES.map((family) => [family.id, family]));
  for (const candidate of PRODUCTION_UNIT_ART_CANDIDATES) {
    if (candidate.status === 'APPROVED') families.set(candidate.family.id, candidate.family);
  }
  return [...families.values()];
}

export function getRuntimeSpriteStrips(): readonly SpriteStrip[] {
  const strips = new Map<string, SpriteStrip>();
  for (const family of getRuntimeArtFamilies()) {
    for (const strip of allFamilyStrips(family)) {
      const existing = strips.get(strip.key);
      if (existing && (existing.url !== strip.url || existing.frameWidth !== strip.frameWidth || existing.frameHeight !== strip.frameHeight)) {
        throw new Error(`runtime sprite key collision: ${strip.key}`);
      }
      strips.set(strip.key, strip);
    }
  }
  return [...strips.values()];
}
