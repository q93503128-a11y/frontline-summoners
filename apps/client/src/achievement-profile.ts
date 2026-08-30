import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  PROFILE_COSMETICS,
  PVP_ACHIEVEMENT_TIERS,
  evaluateAchievements,
  getProfileCosmetic,
  normalizeAchievementFactIds,
  normalizeOwnedProfileCosmeticIds,
  normalizeProfileLoadout,
  normalizePvpAchievementTier,
  type AchievementCategory,
  type AchievementEvaluation,
  type AchievementEvaluationInput,
  type AchievementFactId,
  type ProfileCosmeticDefinition,
  type ProfileCosmeticKind,
  type ProfileLoadout,
  type PvpAchievementTier,
} from '@frontline/sim/achievement-profile';
import { getEvolutionForms } from './character-growth.ts';
import { getOwnedCharacterIds, type GuestProgress } from './save.ts';

export { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, PROFILE_COSMETICS };
export type { AchievementCategory, AchievementEvaluation, ProfileCosmeticDefinition, ProfileCosmeticKind, ProfileLoadout };

const STORAGE_KEY = 'frontline-summoners:achievement-profile:v1';
const STORAGE_SCHEMA_VERSION = 1;
const ACHIEVEMENT_ID_SET = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
const COSMETIC_ID_SET = new Set(PROFILE_COSMETICS.map((cosmetic) => cosmetic.id));
const TIER_INDEX = new Map(PVP_ACHIEVEMENT_TIERS.map((tier, index) => [tier, index] as const));

interface StoredGuestAchievementProfileV1 {
  readonly schemaVersion: 1;
  readonly claimedAchievementIds: readonly string[];
  readonly ownedCosmeticIds: readonly string[];
  readonly profileLoadout: ProfileLoadout;
  readonly factIds: readonly AchievementFactId[];
  readonly pvpBestTier?: PvpAchievementTier;
}

export interface AchievementProfileState {
  readonly evaluations: readonly AchievementEvaluation[];
  readonly claimedAchievementIds: readonly string[];
  readonly ownedCosmeticIds: readonly string[];
  readonly profileLoadout: ProfileLoadout;
  readonly factIds: readonly AchievementFactId[];
  readonly pvpBestTier?: PvpAchievementTier;
  readonly completedCount: number;
  readonly editable: boolean;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function canonicalOwnedCharacterIds(progress: GuestProgress): readonly string[] {
  return getOwnedCharacterIds(progress);
}

function getUnlockedFormCount(progress: GuestProgress, formOrder: 2 | 3): number {
  let count = 0;
  for (const characterId of canonicalOwnedCharacterIds(progress)) {
    const unlocked = new Set(progress.characterProgressById?.[characterId]?.unlockedFormIds ?? []);
    if (getEvolutionForms(characterId).some((form) => form.formOrder === formOrder && unlocked.has(form.formId))) count += 1;
  }
  return count;
}

export function buildAchievementEvaluationInput(
  progress: GuestProgress,
  factIds: readonly AchievementFactId[] = [],
  pvpBestTier?: PvpAchievementTier,
): AchievementEvaluationInput {
  const ownedCharacterIds = canonicalOwnedCharacterIds(progress);
  const characterProgress = ownedCharacterIds.map((characterId) => progress.characterProgressById?.[characterId]).filter((entry) => entry !== undefined);
  const coopClearedStageIds = Object.entries(progress.normalClearSourceByStage ?? {})
    .filter(([, source]) => source === 'COOP_BATTLE')
    .map(([stageId]) => stageId);
  return {
    mainClearedStageIds: progress.clearedStageIds,
    specialClearedStageIds: progress.specialClearedStageIds,
    maxCharacterLevel: characterProgress.reduce((max, entry) => Math.max(max, entry.level), 0),
    maxCharacterPlusLevel: characterProgress.reduce((max, entry) => Math.max(max, entry.plusLevel), 0),
    unlockedF2Count: getUnlockedFormCount(progress, 2),
    unlockedF3Count: getUnlockedFormCount(progress, 3),
    ownedCharacterCount: ownedCharacterIds.length,
    discoveredEnemyCount: new Set(progress.discoveredEnemyIds ?? []).size,
    coopClearedStageIds,
    endlessBestReachedMinute: progress.recordModeProgress?.endlessBestReachedMinute ?? 0,
    bossRushBestDefeated: progress.recordModeProgress?.bossRushBestDefeated ?? 0,
    factIds,
    ...(pvpBestTier === undefined ? {} : { pvpBestTier }),
  };
}

function parseStored(value: unknown, progress: GuestProgress): StoredGuestAchievementProfileV1 {
  const raw = readObject(value);
  const factIds = normalizeAchievementFactIds(raw?.factIds);
  const pvpBestTier = normalizePvpAchievementTier(raw?.pvpBestTier);
  const evaluations = evaluateAchievements(buildAchievementEvaluationInput(progress, factIds, pvpBestTier));
  const completedIds = evaluations.filter((evaluation) => evaluation.complete).map((evaluation) => evaluation.achievementId);
  const claimedAchievementIds = [...new Set([
    ...stringArray(raw?.claimedAchievementIds).filter((id) => ACHIEVEMENT_ID_SET.has(id)),
    ...completedIds,
  ])];
  const ownedCosmeticIds = normalizeOwnedProfileCosmeticIds(
    stringArray(raw?.ownedCosmeticIds).filter((id) => COSMETIC_ID_SET.has(id)),
    claimedAchievementIds,
  );
  const profileLoadout = normalizeProfileLoadout(raw?.profileLoadout, ownedCosmeticIds, canonicalOwnedCharacterIds(progress));
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    claimedAchievementIds,
    ownedCosmeticIds,
    profileLoadout,
    factIds,
    ...(pvpBestTier === undefined ? {} : { pvpBestTier }),
  };
}

function readStoredGuestProfile(progress: GuestProgress): StoredGuestAchievementProfileV1 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return parseStored(undefined, progress);
    const decoded = JSON.parse(raw) as unknown;
    const object = readObject(decoded);
    if (object?.schemaVersion !== STORAGE_SCHEMA_VERSION) return parseStored(undefined, progress);
    return parseStored(decoded, progress);
  } catch {
    return parseStored(undefined, progress);
  }
}

function writeStoredGuestProfile(state: StoredGuestAchievementProfileV1): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function toState(progress: GuestProgress, stored: StoredGuestAchievementProfileV1, editable: boolean): AchievementProfileState {
  const evaluations = evaluateAchievements(buildAchievementEvaluationInput(progress, stored.factIds, stored.pvpBestTier));
  return {
    evaluations,
    claimedAchievementIds: stored.claimedAchievementIds,
    ownedCosmeticIds: stored.ownedCosmeticIds,
    profileLoadout: stored.profileLoadout,
    factIds: stored.factIds,
    ...(stored.pvpBestTier === undefined ? {} : { pvpBestTier: stored.pvpBestTier }),
    completedCount: evaluations.filter((evaluation) => evaluation.complete).length,
    editable,
  };
}

export function loadGuestAchievementProfile(progress: GuestProgress): AchievementProfileState {
  const stored = readStoredGuestProfile(progress);
  writeStoredGuestProfile(stored);
  return toState(progress, stored, true);
}

export function deriveReadOnlyAccountAchievementProfile(progress: GuestProgress): AchievementProfileState {
  const evaluations = evaluateAchievements(buildAchievementEvaluationInput(progress));
  const completedIds = evaluations.filter((evaluation) => evaluation.complete).map((evaluation) => evaluation.achievementId);
  const ownedCosmeticIds = normalizeOwnedProfileCosmeticIds([], completedIds);
  const profileLoadout = normalizeProfileLoadout(undefined, ownedCosmeticIds, canonicalOwnedCharacterIds(progress));
  return {
    evaluations,
    claimedAchievementIds: completedIds,
    ownedCosmeticIds,
    profileLoadout,
    factIds: [],
    completedCount: completedIds.length,
    editable: false,
  };
}

export function saveGuestProfileLoadout(progress: GuestProgress, nextLoadout: ProfileLoadout): AchievementProfileState {
  const stored = readStoredGuestProfile(progress);
  const profileLoadout = normalizeProfileLoadout(nextLoadout, stored.ownedCosmeticIds, canonicalOwnedCharacterIds(progress));
  const next: StoredGuestAchievementProfileV1 = { ...stored, profileLoadout };
  writeStoredGuestProfile(next);
  return toState(progress, next, true);
}

export function recordGuestAchievementFact(progress: GuestProgress, factId: AchievementFactId): AchievementProfileState {
  const stored = readStoredGuestProfile(progress);
  const factIds = normalizeAchievementFactIds([...stored.factIds, factId]);
  const next = parseStored({ ...stored, factIds }, progress);
  writeStoredGuestProfile(next);
  return toState(progress, next, true);
}

export function recordGuestPvpAchievementTier(progress: GuestProgress, tier: PvpAchievementTier): AchievementProfileState {
  const stored = readStoredGuestProfile(progress);
  const currentIndex = stored.pvpBestTier === undefined ? -1 : (TIER_INDEX.get(stored.pvpBestTier) ?? -1);
  const nextIndex = TIER_INDEX.get(tier) ?? -1;
  const pvpBestTier = nextIndex >= currentIndex ? tier : stored.pvpBestTier;
  const next = parseStored({ ...stored, ...(pvpBestTier === undefined ? {} : { pvpBestTier }) }, progress);
  writeStoredGuestProfile(next);
  return toState(progress, next, true);
}

export function getOwnedCosmeticsByKind(state: AchievementProfileState, kind: ProfileCosmeticKind): readonly ProfileCosmeticDefinition[] {
  const owned = new Set(state.ownedCosmeticIds);
  return PROFILE_COSMETICS.filter((cosmetic) => cosmetic.kind === kind && owned.has(cosmetic.id));
}

export function getAchievementRewardNames(achievementId: string): readonly string[] {
  const definition = ACHIEVEMENTS.find((achievement) => achievement.id === achievementId);
  if (!definition) return [];
  return definition.cosmeticRewardIds.map((rewardId) => getProfileCosmetic(rewardId).name);
}
