import {
  SPECIAL_STAGES,
  STAGES,
  getContiguousClearedStageIds,
  getStage,
  getTreasureIdsForClearedStages,
  isSpecialStageUnlocked,
  isStageUnlocked,
} from './prototype.ts';

export interface GuestProgress {
  /** Sequential PROGRESSION clears only. */
  readonly clearedStageIds: readonly string[];
  /** Optional SPECIAL clears. Never count these as main-campaign progression. */
  readonly specialClearedStageIds: readonly string[];
  readonly treasureIds: readonly string[];
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

interface StoredGuestProgressV2 {
  readonly schemaVersion: 2;
  readonly clearedStageIds: readonly string[];
  readonly treasureIds: readonly string[];
}

interface StoredGuestProgress extends GuestProgress {
  readonly schemaVersion: 3;
}

const DB_NAME = 'frontline-summoners';
const STORE_NAME = 'guest-progress';
const KEY = 'progress';
const SCHEMA_VERSION = 3;
const EMPTY_PROGRESS: GuestProgress = { clearedStageIds: [], specialClearedStageIds: [], treasureIds: [] };
const STAGE_TREASURE_IDS = new Set(STAGES.map((stage) => stage.treasure.id));
const SPECIAL_STAGE_IDS = new Set(SPECIAL_STAGES.map((stage) => stage.id));
let sessionProgress: GuestProgress = EMPTY_PROGRESS;

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

export function mergeGuestProgress(a: GuestProgress, b: GuestProgress): GuestProgress {
  return {
    clearedStageIds: [...new Set([...a.clearedStageIds, ...b.clearedStageIds])],
    specialClearedStageIds: [...new Set([...a.specialClearedStageIds, ...b.specialClearedStageIds])],
    treasureIds: [...new Set([...a.treasureIds, ...b.treasureIds])],
  };
}

export function normalizeGuestProgress(progress: GuestProgress): GuestProgress {
  const clearedStageIds = getContiguousClearedStageIds(progress.clearedStageIds);
  const specialClearedStageIds = [...new Set(progress.specialClearedStageIds.filter((stageId) => SPECIAL_STAGE_IDS.has(stageId)))];
  const guaranteedTreasureIds = getTreasureIdsForClearedStages(clearedStageIds);
  const nonStageTreasureIds = progress.treasureIds.filter((treasureId) => !STAGE_TREASURE_IDS.has(treasureId));
  return {
    clearedStageIds,
    specialClearedStageIds,
    treasureIds: [...new Set([...guaranteedTreasureIds, ...nonStageTreasureIds])],
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
      const value = request.result as Partial<StoredGuestProgress | StoredGuestProgressV2> | undefined;
      if (value?.schemaVersion !== 2 && value?.schemaVersion !== SCHEMA_VERSION) {
        resolve(EMPTY_PROGRESS);
        return;
      }
      resolve({
        clearedStageIds: stringArray(value.clearedStageIds),
        specialClearedStageIds: value.schemaVersion === SCHEMA_VERSION ? stringArray((value as Partial<StoredGuestProgress>).specialClearedStageIds) : [],
        treasureIds: stringArray(value.treasureIds),
      });
    };
    request.onerror = () => reject(request.error ?? new Error('indexedDB read failed'));
    tx.oncomplete = () => db.close();
  });
}

async function persistProgress(progress: GuestProgress): Promise<boolean> {
  const stored: StoredGuestProgress = { ...progress, schemaVersion: SCHEMA_VERSION };
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
    clearedStageIds: [...cleared],
    specialClearedStageIds: before.specialClearedStageIds,
    treasureIds: [...treasures],
  });

  // Apply the result to the in-memory session before persistence. A storage failure must not
  // immediately relock the next stage in the same tab, but it must be reported to the UI.
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
    clearedStageIds: before.clearedStageIds,
    specialClearedStageIds: [...specialClears],
    treasureIds: before.treasureIds,
  });

  sessionProgress = progress;
  const persisted = await persistProgress(progress);
  return { firstClear, progress, persisted };
}
