import {
  SPECIAL_STAGES,
  STAGES,
  getContiguousClearedStageIds,
  getStage,
  getTreasureIdsForClearedStages,
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

const DB_NAME = 'frontline-summoners';
const STORE_NAME = 'guest-progress';
const KEY = 'progress';
const SCHEMA_VERSION = 4;
const EMPTY_PROGRESS: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  treasureIds: [],
  ownedRecruitmentCharacterIds: [],
  recruitmentProgressByBanner: {},
};
const STAGE_TREASURE_IDS = new Set(STAGES.map((stage) => stage.treasure.id));
const SPECIAL_STAGE_IDS = new Set(SPECIAL_STAGES.map((stage) => stage.id));
const RECRUITMENT_CHARACTER_IDS = new Set(RECRUITMENT_UNITS.map((unit) => unit.id));
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
      // Equal pull count with fewer credits means the player may already have spent a selection credit.
      // Prefer the lower balance so durable/session reconciliation never resurrects a consumed choice.
      merged[bannerId] = {
        totalPulls: left.totalPulls,
        selectionCredits: Math.min(left.selectionCredits, right.selectionCredits),
      };
    }
  }
  return merged;
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
  return {
    clearedStageIds,
    specialClearedStageIds,
    treasureIds: [...new Set([...guaranteedTreasureIds, ...nonStageTreasureIds])],
    ownedRecruitmentCharacterIds,
    recruitmentProgressByBanner: normalizeRecruitmentMap(progress.recruitmentProgressByBanner ?? {}),
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
      const value = request.result as Partial<StoredGuestProgressV2 | StoredGuestProgressV3 | StoredGuestProgressV4> | undefined;
      if (value?.schemaVersion !== 2 && value?.schemaVersion !== 3 && value?.schemaVersion !== SCHEMA_VERSION) {
        resolve(EMPTY_PROGRESS);
        return;
      }
      const isV3OrLater = value.schemaVersion === 3 || value.schemaVersion === SCHEMA_VERSION;
      const isV4 = value.schemaVersion === SCHEMA_VERSION;
      resolve({
        clearedStageIds: stringArray(value.clearedStageIds),
        specialClearedStageIds: isV3OrLater ? stringArray((value as Partial<StoredGuestProgressV3 | StoredGuestProgressV4>).specialClearedStageIds) : [],
        treasureIds: stringArray(value.treasureIds),
        ownedRecruitmentCharacterIds: isV4 ? stringArray((value as Partial<StoredGuestProgressV4>).ownedRecruitmentCharacterIds) : [],
        recruitmentProgressByBanner: isV4
          ? normalizeRecruitmentMap((value as Partial<StoredGuestProgressV4>).recruitmentProgressByBanner)
          : {},
      });
    };
    request.onerror = () => reject(request.error ?? new Error('indexedDB read failed'));
    tx.oncomplete = () => db.close();
  });
}

async function persistProgress(progress: GuestProgress): Promise<boolean> {
  const normalized = normalizeGuestProgress(progress);
  const stored: StoredGuestProgressV4 = {
    schemaVersion: SCHEMA_VERSION,
    clearedStageIds: normalized.clearedStageIds,
    specialClearedStageIds: normalized.specialClearedStageIds,
    treasureIds: normalized.treasureIds,
    ownedRecruitmentCharacterIds: normalized.ownedRecruitmentCharacterIds ?? [],
    recruitmentProgressByBanner: normalized.recruitmentProgressByBanner ?? {},
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
    // IndexedDB can be unavailable in restrictive/private browser contexts.
    // Preserve progress already earned in this tab instead of silently resetting the session.
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