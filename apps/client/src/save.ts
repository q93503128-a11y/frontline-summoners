import {
  ALL_PLAYER_SLOTS,
  SPECIAL_STAGES,
  STAGES,
  STARTER_SLOT_ID,
  getContiguousClearedStageIds,
  getStage,
  getTreasureIdsForClearedStages,
  getUnlockedSlotIds,
  isSpecialStageUnlocked,
  isStageUnlocked,
} from './prototype.ts';
import {
  FIRST_RECRUITMENT_BANNER,
  RECRUITMENT_UNITS,
  recruit,
  redeemBannerSelection,
  type RecruitmentBatchResult,
  type RecruitmentProgress,
  type RecruitmentRandomSource,
} from './recruitment.ts';
import {
  getEvolutionForm,
  getEvolutionForms,
  normalizeCharacterLevel,
} from './character-growth.ts';

export const MAX_DECK_SLOTS = 10;

export interface CharacterMetaProgress {
  readonly level: number;
  readonly unlockedFormIds: readonly string[];
  readonly selectedFormId?: string;
}

export interface GuestProgress {
  /** Sequential PROGRESSION clears only. */
  readonly clearedStageIds: readonly string[];
  /** Optional SPECIAL clears. Never count these as main-campaign progression. */
  readonly specialClearedStageIds: readonly string[];
  readonly treasureIds: readonly string[];
  /** Recruitment ownership is stored separately from free campaign unlocks. */
  readonly ownedRecruitmentCharacterIds?: readonly string[];
  /** Sparse per-banner pity/selection state. Missing means zero pulls and zero credits. */
  readonly recruitmentProgressByBanner?: Readonly<Record<string, RecruitmentProgress>>;
  /** Level/form state for currently owned characters. */
  readonly characterProgressById?: Readonly<Record<string, CharacterMetaProgress>>;
  /** Undefined means legacy/automatic formation. Once set, this is the explicit 1~10 slot solo deck. */
  readonly deckSlotIds?: readonly string[];
}

export interface StageClearResult {
  readonly firstClear: boolean;
  readonly treasureNew: boolean;
  readonly progress: GuestProgress;
  /** True only when IndexedDB confirmed the write transaction. */
  readonly persisted: boolean;
}

export interface SpecialStageClearResult {
  readonly firstClear: boolean;
  readonly progress: GuestProgress;
  /** True only when IndexedDB confirmed the write transaction. */
  readonly persisted: boolean;
}

export interface GuestRecruitmentResult extends RecruitmentBatchResult {
  /** True only when IndexedDB confirmed the write transaction. */
  readonly persisted: boolean;
  readonly guestProgress: GuestProgress;
}

export interface GuestBannerSelectionResult {
  readonly characterId: string;
  readonly duplicate: boolean;
  readonly persisted: boolean;
  readonly guestProgress: GuestProgress;
}

export interface GuestCharacterProgressResult {
  readonly characterId: string;
  readonly characterProgress: CharacterMetaProgress;
  readonly persisted: boolean;
  readonly guestProgress: GuestProgress;
}

export interface GuestDeckResult {
  readonly deckSlotIds: readonly string[];
  readonly persisted: boolean;
  readonly guestProgress: GuestProgress;
}

interface StoredGuestProgressV2 {
  readonly schemaVersion: 2;
  readonly clearedStageIds: readonly string[];
  readonly treasureIds: readonly string[];
}

interface StoredGuestProgressV3 {
  readonly schemaVersion: 3;
  readonly clearedStageIds: readonly string[];
  readonly specialClearedStageIds: readonly string[];
  readonly treasureIds: readonly string[];
}

interface StoredGuestProgressV4 {
  readonly schemaVersion: 4;
  readonly clearedStageIds: readonly string[];
  readonly specialClearedStageIds: readonly string[];
  readonly treasureIds: readonly string[];
  readonly ownedRecruitmentCharacterIds: readonly string[];
  readonly recruitmentProgressByBanner: Readonly<Record<string, RecruitmentProgress>>;
}

interface StoredGuestProgressV5 {
  readonly schemaVersion: 5;
  readonly clearedStageIds: readonly string[];
  readonly specialClearedStageIds: readonly string[];
  readonly treasureIds: readonly string[];
  readonly ownedRecruitmentCharacterIds: readonly string[];
  readonly recruitmentProgressByBanner: Readonly<Record<string, RecruitmentProgress>>;
  readonly characterProgressById: Readonly<Record<string, CharacterMetaProgress>>;
}

interface StoredGuestProgressV6 {
  readonly schemaVersion: 6;
  readonly clearedStageIds: readonly string[];
  readonly specialClearedStageIds: readonly string[];
  readonly treasureIds: readonly string[];
  readonly ownedRecruitmentCharacterIds: readonly string[];
  readonly recruitmentProgressByBanner: Readonly<Record<string, RecruitmentProgress>>;
  readonly characterProgressById: Readonly<Record<string, CharacterMetaProgress>>;
  readonly deckSlotIds?: readonly string[];
}

const DB_NAME = 'frontline-summoners';
const STORE_NAME = 'guest-progress';
const KEY = 'progress';
const SCHEMA_VERSION = 6;
const EMPTY_PROGRESS: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  treasureIds: [],
  ownedRecruitmentCharacterIds: [],
  recruitmentProgressByBanner: {},
  characterProgressById: {},
};
const STAGE_TREASURE_IDS = new Set(STAGES.map((stage) => stage.treasure.id));
const SPECIAL_STAGE_IDS = new Set(SPECIAL_STAGES.map((stage) => stage.id));
const RECRUITMENT_CHARACTER_IDS = new Set(RECRUITMENT_UNITS.map((unit) => unit.id));
const ALL_CHARACTER_IDS = new Set(ALL_PLAYER_SLOTS.map((slot) => slot.slotId));
let sessionProgress: GuestProgress = EMPTY_PROGRESS;

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

function normalizeRecruitmentProgress(value: unknown): RecruitmentProgress | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const totalPulls = record.totalPulls;
  const selectionCredits = record.selectionCredits;
  if (!Number.isInteger(totalPulls) || (totalPulls as number) < 0) return null;
  if (!Number.isInteger(selectionCredits) || (selectionCredits as number) < 0) return null;
  return { totalPulls: totalPulls as number, selectionCredits: selectionCredits as number };
}

function normalizeRecruitmentMap(value: unknown): Readonly<Record<string, RecruitmentProgress>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const result: Record<string, RecruitmentProgress> = {};
  for (const [bannerId, rawProgress] of Object.entries(value as Record<string, unknown>)) {
    if (!bannerId.trim()) continue;
    const normalized = normalizeRecruitmentProgress(rawProgress);
    if (normalized) result[bannerId] = normalized;
  }
  return result;
}

function mergeRecruitmentMaps(
  a: Readonly<Record<string, RecruitmentProgress>>,
  b: Readonly<Record<string, RecruitmentProgress>>,
): Readonly<Record<string, RecruitmentProgress>> {
  const merged: Record<string, RecruitmentProgress> = {};
  for (const bannerId of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const left = a[bannerId];
    const right = b[bannerId];
    if (!left) {
      if (right) merged[bannerId] = right;
      continue;
    }
    if (!right) {
      merged[bannerId] = left;
      continue;
    }
    if (left.totalPulls !== right.totalPulls) {
      merged[bannerId] = left.totalPulls > right.totalPulls ? left : right;
    } else {
      merged[bannerId] = {
        totalPulls: left.totalPulls,
        selectionCredits: Math.min(left.selectionCredits, right.selectionCredits),
      };
    }
  }
  return merged;
}

function parseCharacterMetaProgress(value: unknown): CharacterMetaProgress | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const level = raw.level;
  if (typeof level !== 'number' || !Number.isFinite(level)) return null;
  const unlockedFormIds = stringArray(raw.unlockedFormIds);
  const selectedFormId = typeof raw.selectedFormId === 'string' ? raw.selectedFormId : undefined;
  return {
    level: normalizeCharacterLevel(level),
    unlockedFormIds,
    ...(selectedFormId === undefined ? {} : { selectedFormId }),
  };
}

function mergeCharacterProgressMaps(
  a: Readonly<Record<string, CharacterMetaProgress>>,
  b: Readonly<Record<string, CharacterMetaProgress>>,
): Readonly<Record<string, CharacterMetaProgress>> {
  const merged: Record<string, CharacterMetaProgress> = {};
  for (const characterId of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const left = a[characterId];
    const right = b[characterId];
    if (!left) {
      if (right) merged[characterId] = right;
      continue;
    }
    if (!right) {
      merged[characterId] = left;
      continue;
    }
    const unlockedFormIds = [...new Set([...left.unlockedFormIds, ...right.unlockedFormIds])];
    const preferredSelection = right.level >= left.level
      ? right.selectedFormId ?? left.selectedFormId
      : left.selectedFormId ?? right.selectedFormId;
    merged[characterId] = {
      level: Math.max(left.level, right.level),
      unlockedFormIds,
      ...(preferredSelection === undefined ? {} : { selectedFormId: preferredSelection }),
    };
  }
  return merged;
}

function ownedCharacterIdsForProgress(
  clearedStageIds: readonly string[],
  ownedRecruitmentCharacterIds: readonly string[],
): ReadonlySet<string> {
  return new Set([
    ...getUnlockedSlotIds(clearedStageIds),
    ...ownedRecruitmentCharacterIds,
  ]);
}

function normalizeCharacterProgressMap(
  value: unknown,
  ownedCharacterIds: ReadonlySet<string>,
): Readonly<Record<string, CharacterMetaProgress>> {
  const rawMap = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const result: Record<string, CharacterMetaProgress> = {};

  for (const characterId of ownedCharacterIds) {
    if (!ALL_CHARACTER_IDS.has(characterId)) continue;
    const parsed = parseCharacterMetaProgress(rawMap[characterId]);
    const forms = getEvolutionForms(characterId);
    const validFormIds = new Set(forms.map((form) => form.formId));
    const baseFormId = forms.find((form) => form.formOrder === 1)?.formId;
    const unlockedFormIds = [...new Set([
      ...(baseFormId ? [baseFormId] : []),
      ...(parsed?.unlockedFormIds ?? []).filter((formId) => validFormIds.has(formId)),
    ])];
    const selectedFormId = parsed?.selectedFormId && unlockedFormIds.includes(parsed.selectedFormId)
      ? parsed.selectedFormId
      : baseFormId;
    result[characterId] = {
      level: normalizeCharacterLevel(parsed?.level ?? 1),
      unlockedFormIds,
      ...(selectedFormId === undefined ? {} : { selectedFormId }),
    };
  }
  return result;
}

function normalizeExplicitDeckSlotIds(value: unknown, ownedCharacterIds: ReadonlySet<string>): readonly string[] | undefined {
  if (value === undefined) return undefined;
  const ids = stringArray(value).filter((id) => ownedCharacterIds.has(id) && ALL_CHARACTER_IDS.has(id));
  const unique = [...new Set(ids)].slice(0, MAX_DECK_SLOTS);
  return unique.length > 0 ? unique : undefined;
}

export function getOwnedCharacterIds(progress: GuestProgress): readonly string[] {
  const normalized = normalizeGuestProgress(progress);
  const owned = ownedCharacterIdsForProgress(
    normalized.clearedStageIds,
    normalized.ownedRecruitmentCharacterIds ?? [],
  );
  return ALL_PLAYER_SLOTS.filter((slot) => owned.has(slot.slotId)).map((slot) => slot.slotId);
}

export function getEffectiveDeckSlotIds(progress: GuestProgress): readonly string[] {
  const normalized = normalizeGuestProgress(progress);
  if (normalized.deckSlotIds && normalized.deckSlotIds.length > 0) return normalized.deckSlotIds;
  return getOwnedCharacterIds(normalized).slice(0, MAX_DECK_SLOTS);
}

export function mergeGuestProgress(a: GuestProgress, b: GuestProgress): GuestProgress {
  return {
    clearedStageIds: [...new Set([...a.clearedStageIds, ...b.clearedStageIds])],
    specialClearedStageIds: [...new Set([...a.specialClearedStageIds, ...b.specialClearedStageIds])],
    treasureIds: [...new Set([...a.treasureIds, ...b.treasureIds])],
    ownedRecruitmentCharacterIds: [...new Set([
      ...(a.ownedRecruitmentCharacterIds ?? []),
      ...(b.ownedRecruitmentCharacterIds ?? []),
    ])],
    recruitmentProgressByBanner: mergeRecruitmentMaps(
      a.recruitmentProgressByBanner ?? {},
      b.recruitmentProgressByBanner ?? {},
    ),
    characterProgressById: mergeCharacterProgressMaps(
      a.characterProgressById ?? {},
      b.characterProgressById ?? {},
    ),
    ...(b.deckSlotIds !== undefined
      ? { deckSlotIds: b.deckSlotIds }
      : a.deckSlotIds !== undefined
        ? { deckSlotIds: a.deckSlotIds }
        : {}),
  };
}

export function normalizeGuestProgress(progress: GuestProgress): GuestProgress {
  const clearedStageIds = getContiguousClearedStageIds(progress.clearedStageIds);
  const specialClearedStageIds = [...new Set(progress.specialClearedStageIds.filter((stageId) => SPECIAL_STAGE_IDS.has(stageId)))];
  const guaranteedTreasureIds = getTreasureIdsForClearedStages(clearedStageIds);
  const nonStageTreasureIds = progress.treasureIds.filter((treasureId) => !STAGE_TREASURE_IDS.has(treasureId));
  const ownedRecruitmentCharacterIds = [...new Set(
    (progress.ownedRecruitmentCharacterIds ?? []).filter((characterId) => RECRUITMENT_CHARACTER_IDS.has(characterId)),
  )];
  const ownedCharacterIds = ownedCharacterIdsForProgress(clearedStageIds, ownedRecruitmentCharacterIds);
  const deckSlotIds = normalizeExplicitDeckSlotIds(progress.deckSlotIds, ownedCharacterIds);
  return {
    clearedStageIds,
    specialClearedStageIds,
    treasureIds: [...new Set([...guaranteedTreasureIds, ...nonStageTreasureIds])],
    ownedRecruitmentCharacterIds,
    recruitmentProgressByBanner: normalizeRecruitmentMap(progress.recruitmentProgressByBanner ?? {}),
    characterProgressById: normalizeCharacterProgressMap(progress.characterProgressById ?? {}, ownedCharacterIds),
    ...(deckSlotIds === undefined ? {} : { deckSlotIds }),
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'));
  });
}

function readStoredProgress(db: IDBDatabase): Promise<GuestProgress> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(KEY);
    request.onsuccess = () => {
      const value = request.result as Partial<StoredGuestProgressV2 | StoredGuestProgressV3 | StoredGuestProgressV4 | StoredGuestProgressV5 | StoredGuestProgressV6> | undefined;
      if (value?.schemaVersion !== 2 && value?.schemaVersion !== 3 && value?.schemaVersion !== 4 && value?.schemaVersion !== 5 && value?.schemaVersion !== SCHEMA_VERSION) {
        resolve(EMPTY_PROGRESS);
        return;
      }
      const version = value.schemaVersion;
      const hasSpecial = version >= 3;
      const hasRecruitment = version >= 4;
      const hasCharacterProgress = version >= 5;
      const hasDeck = version >= 6;
      resolve({
        clearedStageIds: stringArray(value.clearedStageIds),
        specialClearedStageIds: hasSpecial ? stringArray((value as Partial<StoredGuestProgressV3 | StoredGuestProgressV4 | StoredGuestProgressV5 | StoredGuestProgressV6>).specialClearedStageIds) : [],
        treasureIds: stringArray(value.treasureIds),
        ownedRecruitmentCharacterIds: hasRecruitment
          ? stringArray((value as Partial<StoredGuestProgressV4 | StoredGuestProgressV5 | StoredGuestProgressV6>).ownedRecruitmentCharacterIds)
          : [],
        recruitmentProgressByBanner: hasRecruitment
          ? normalizeRecruitmentMap((value as Partial<StoredGuestProgressV4 | StoredGuestProgressV5 | StoredGuestProgressV6>).recruitmentProgressByBanner)
          : {},
        characterProgressById: hasCharacterProgress
          ? (value as Partial<StoredGuestProgressV5 | StoredGuestProgressV6>).characterProgressById ?? {}
          : {},
        ...(hasDeck && (value as Partial<StoredGuestProgressV6>).deckSlotIds !== undefined
          ? { deckSlotIds: stringArray((value as Partial<StoredGuestProgressV6>).deckSlotIds) }
          : {}),
      });
    };
    request.onerror = () => reject(request.error ?? new Error('indexedDB read failed'));
    tx.oncomplete = () => db.close();
  });
}

async function persistProgress(progress: GuestProgress): Promise<boolean> {
  const normalized = normalizeGuestProgress(progress);
  const stored: StoredGuestProgressV6 = {
    schemaVersion: SCHEMA_VERSION,
    clearedStageIds: normalized.clearedStageIds,
    specialClearedStageIds: normalized.specialClearedStageIds,
    treasureIds: normalized.treasureIds,
    ownedRecruitmentCharacterIds: normalized.ownedRecruitmentCharacterIds ?? [],
    recruitmentProgressByBanner: normalized.recruitmentProgressByBanner ?? {},
    characterProgressById: normalized.characterProgressById ?? {},
    ...(normalized.deckSlotIds === undefined ? {} : { deckSlotIds: normalized.deckSlotIds }),
  };
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(stored, KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error ?? new Error('indexedDB write failed'));
      tx.onabort = () => reject(tx.error ?? new Error('indexedDB write aborted'));
    });
    return true;
  } catch {
    return false;
  }
}

export async function loadGuestProgress(): Promise<GuestProgress> {
  try {
    const db = await openDb();
    const stored = normalizeGuestProgress(await readStoredProgress(db));
    const currentSession = normalizeGuestProgress(sessionProgress);
    sessionProgress = normalizeGuestProgress(mergeGuestProgress(stored, currentSession));
  } catch {
    sessionProgress = normalizeGuestProgress(sessionProgress);
  }
  return sessionProgress;
}

export async function recordStageClear(stageId: string, claimedTreasureId: string): Promise<StageClearResult> {
  const before = await loadGuestProgress();
  const stage = getStage(stageId);
  if (stage.stageType !== 'PROGRESSION') throw new Error(`Not a progression stage: ${stage.id}`);
  if (!isStageUnlocked(stage.id, before.clearedStageIds)) {
    throw new Error(`Campaign stage is not unlocked: ${stage.id}`);
  }
  if (claimedTreasureId !== stage.treasure.id) {
    throw new Error(`Treasure does not match campaign stage ${stage.id}: ${claimedTreasureId}`);
  }

  const cleared = new Set(before.clearedStageIds);
  const treasures = new Set(before.treasureIds);
  const firstClear = !cleared.has(stage.id);
  const treasureNew = !treasures.has(stage.treasure.id);
  cleared.add(stage.id);
  treasures.add(stage.treasure.id);
  const progress = normalizeGuestProgress({
    ...before,
    clearedStageIds: [...cleared],
    treasureIds: [...treasures],
  });

  sessionProgress = progress;
  const persisted = await persistProgress(progress);
  return { firstClear, treasureNew, progress, persisted };
}

export async function recordSpecialStageClear(stageId: string): Promise<SpecialStageClearResult> {
  const before = await loadGuestProgress();
  const stage = getStage(stageId);
  if (stage.stageType !== 'SPECIAL') throw new Error(`Not a special stage: ${stage.id}`);
  if (!isSpecialStageUnlocked(stage.id, before.clearedStageIds)) {
    throw new Error(`Special stage is not unlocked: ${stage.id}`);
  }

  const specialClears = new Set(before.specialClearedStageIds);
  const firstClear = !specialClears.has(stage.id);
  specialClears.add(stage.id);
  const progress = normalizeGuestProgress({
    ...before,
    specialClearedStageIds: [...specialClears],
  });

  sessionProgress = progress;
  const persisted = await persistProgress(progress);
  return { firstClear, progress, persisted };
}

export async function performGuestRecruitment(
  count: number,
  rng: RecruitmentRandomSource,
  banner = FIRST_RECRUITMENT_BANNER,
): Promise<GuestRecruitmentResult> {
  const before = normalizeGuestProgress(await loadGuestProgress());
  const previousBannerProgress = before.recruitmentProgressByBanner?.[banner.id] ?? { totalPulls: 0, selectionCredits: 0 };
  const batch = recruit(
    previousBannerProgress,
    before.ownedRecruitmentCharacterIds ?? [],
    count,
    rng,
    banner,
  );
  const progress = normalizeGuestProgress({
    ...before,
    ownedRecruitmentCharacterIds: batch.ownedCharacterIds,
    recruitmentProgressByBanner: {
      ...(before.recruitmentProgressByBanner ?? {}),
      [banner.id]: batch.progress,
    },
  });
  sessionProgress = progress;
  const persisted = await persistProgress(progress);
  return { ...batch, persisted, guestProgress: progress };
}

export async function redeemGuestBannerSelection(
  characterId: string,
  banner = FIRST_RECRUITMENT_BANNER,
): Promise<GuestBannerSelectionResult> {
  const before = normalizeGuestProgress(await loadGuestProgress());
  const previousBannerProgress = before.recruitmentProgressByBanner?.[banner.id] ?? { totalPulls: 0, selectionCredits: 0 };
  const selected = redeemBannerSelection(
    previousBannerProgress,
    before.ownedRecruitmentCharacterIds ?? [],
    characterId,
    banner,
  );
  const progress = normalizeGuestProgress({
    ...before,
    ownedRecruitmentCharacterIds: selected.ownedCharacterIds,
    recruitmentProgressByBanner: {
      ...(before.recruitmentProgressByBanner ?? {}),
      [banner.id]: selected.progress,
    },
  });
  sessionProgress = progress;
  const persisted = await persistProgress(progress);
  return { characterId, duplicate: selected.duplicate, persisted, guestProgress: progress };
}

function requireOwnedCharacter(progress: GuestProgress, characterId: string): CharacterMetaProgress {
  const normalized = normalizeGuestProgress(progress);
  const characterProgress = normalized.characterProgressById?.[characterId];
  if (!characterProgress) throw new Error(`Character is not owned: ${characterId}`);
  return characterProgress;
}

export async function recordGuestCharacterLevel(
  characterId: string,
  level: number,
): Promise<GuestCharacterProgressResult> {
  const before = normalizeGuestProgress(await loadGuestProgress());
  const current = requireOwnedCharacter(before, characterId);
  const nextLevel = normalizeCharacterLevel(level);
  if (nextLevel < current.level) throw new Error('character level cannot decrease');
  const progress = normalizeGuestProgress({
    ...before,
    characterProgressById: {
      ...(before.characterProgressById ?? {}),
      [characterId]: { ...current, level: nextLevel },
    },
  });
  sessionProgress = progress;
  const persisted = await persistProgress(progress);
  return { characterId, characterProgress: progress.characterProgressById![characterId]!, persisted, guestProgress: progress };
}

export async function recordGuestEvolutionUnlock(
  characterId: string,
  formId: string,
): Promise<GuestCharacterProgressResult> {
  const before = normalizeGuestProgress(await loadGuestProgress());
  const current = requireOwnedCharacter(before, characterId);
  const form = getEvolutionForm(formId);
  if (form.characterId !== characterId) throw new Error(`Evolution form ${formId} does not belong to ${characterId}`);
  if (form.formOrder > 1) {
    const previousForm = getEvolutionForms(characterId).find((candidate) => candidate.formOrder === form.formOrder - 1);
    if (!previousForm || !current.unlockedFormIds.includes(previousForm.formId)) {
      throw new Error(`Previous evolution form must be unlocked first: ${formId}`);
    }
  }
  const progress = normalizeGuestProgress({
    ...before,
    characterProgressById: {
      ...(before.characterProgressById ?? {}),
      [characterId]: {
        ...current,
        unlockedFormIds: [...new Set([...current.unlockedFormIds, formId])],
      },
    },
  });
  sessionProgress = progress;
  const persisted = await persistProgress(progress);
  return { characterId, characterProgress: progress.characterProgressById![characterId]!, persisted, guestProgress: progress };
}

export async function selectGuestEvolutionForm(
  characterId: string,
  formId: string,
): Promise<GuestCharacterProgressResult> {
  const before = normalizeGuestProgress(await loadGuestProgress());
  const current = requireOwnedCharacter(before, characterId);
  const form = getEvolutionForm(formId);
  if (form.characterId !== characterId) throw new Error(`Evolution form ${formId} does not belong to ${characterId}`);
  if (!current.unlockedFormIds.includes(formId)) throw new Error(`Evolution form is not unlocked: ${formId}`);
  const progress = normalizeGuestProgress({
    ...before,
    characterProgressById: {
      ...(before.characterProgressById ?? {}),
      [characterId]: { ...current, selectedFormId: formId },
    },
  });
  sessionProgress = progress;
  const persisted = await persistProgress(progress);
  return { characterId, characterProgress: progress.characterProgressById![characterId]!, persisted, guestProgress: progress };
}

export async function recordGuestDeck(slotIds: readonly string[]): Promise<GuestDeckResult> {
  if (slotIds.length < 1 || slotIds.length > MAX_DECK_SLOTS) {
    throw new Error(`Deck must contain 1..${MAX_DECK_SLOTS} characters`);
  }
  if (new Set(slotIds).size !== slotIds.length) throw new Error('Deck must not contain duplicate characters');

  const before = normalizeGuestProgress(await loadGuestProgress());
  const owned = new Set(getOwnedCharacterIds(before));
  for (const slotId of slotIds) {
    if (!owned.has(slotId)) throw new Error(`Deck character is not owned: ${slotId}`);
  }

  const progress = normalizeGuestProgress({ ...before, deckSlotIds: [...slotIds] });
  sessionProgress = progress;
  const persisted = await persistProgress(progress);
  return { deckSlotIds: progress.deckSlotIds!, persisted, guestProgress: progress };
}

export async function resetGuestDeckToAutomatic(): Promise<GuestDeckResult> {
  const before = normalizeGuestProgress(await loadGuestProgress());
  const { deckSlotIds: _deckSlotIds, ...withoutDeck } = before;
  const progress = normalizeGuestProgress(withoutDeck);
  sessionProgress = progress;
  const persisted = await persistProgress(progress);
  return { deckSlotIds: getEffectiveDeckSlotIds(progress), persisted, guestProgress: progress };
}

export { STARTER_SLOT_ID };
