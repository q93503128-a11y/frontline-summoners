export interface GuestProgress {
  readonly clearedStageIds: readonly string[];
  readonly treasureIds: readonly string[];
}

export interface StageClearResult {
  readonly firstClear: boolean;
  readonly treasureNew: boolean;
  readonly progress: GuestProgress;
  /** True only when IndexedDB confirmed the write transaction. */
  readonly persisted: boolean;
}

interface StoredGuestProgress extends GuestProgress {
  readonly schemaVersion: number;
}

const DB_NAME = 'frontline-summoners';
const STORE_NAME = 'guest-progress';
const KEY = 'progress';
const SCHEMA_VERSION = 2;
const EMPTY_PROGRESS: GuestProgress = { clearedStageIds: [], treasureIds: [] };
let sessionProgress: GuestProgress = EMPTY_PROGRESS;

export function mergeGuestProgress(a: GuestProgress, b: GuestProgress): GuestProgress {
  return {
    clearedStageIds: [...new Set([...a.clearedStageIds, ...b.clearedStageIds])],
    treasureIds: [...new Set([...a.treasureIds, ...b.treasureIds])],
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
      const value = request.result as Partial<StoredGuestProgress> | undefined;
      if (value?.schemaVersion !== SCHEMA_VERSION) {
        resolve(EMPTY_PROGRESS);
        return;
      }
      resolve({
        clearedStageIds: Array.isArray(value.clearedStageIds) ? value.clearedStageIds.filter((id): id is string => typeof id === 'string') : [],
        treasureIds: Array.isArray(value.treasureIds) ? value.treasureIds.filter((id): id is string => typeof id === 'string') : [],
      });
    };
    request.onerror = () => reject(request.error ?? new Error('indexedDB read failed'));
    tx.oncomplete = () => db.close();
  });
}

export async function loadGuestProgress(): Promise<GuestProgress> {
  try {
    const db = await openDb();
    const stored = await readStoredProgress(db);
    sessionProgress = mergeGuestProgress(stored, sessionProgress);
  } catch {
    // IndexedDB can be unavailable in restrictive/private browser contexts.
    // Preserve progress already earned in this tab instead of silently resetting the session.
  }
  return sessionProgress;
}

export async function recordStageClear(stageId: string, treasureId: string): Promise<StageClearResult> {
  const before = await loadGuestProgress();
  const cleared = new Set(before.clearedStageIds);
  const treasures = new Set(before.treasureIds);
  const firstClear = !cleared.has(stageId);
  const treasureNew = !treasures.has(treasureId);
  cleared.add(stageId);
  treasures.add(treasureId);
  const progress: GuestProgress = { clearedStageIds: [...cleared], treasureIds: [...treasures] };
  const stored: StoredGuestProgress = { ...progress, schemaVersion: SCHEMA_VERSION };

  // Apply the result to the in-memory session before persistence. A storage failure must not
  // immediately relock the next stage in the same tab, but it must be reported to the UI.
  sessionProgress = progress;
  let persisted = false;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(stored, KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error ?? new Error('indexedDB write failed'));
      tx.onabort = () => reject(tx.error ?? new Error('indexedDB write aborted'));
    });
    persisted = true;
  } catch {
    // Gameplay remains usable in-memory. The result screen explicitly reports that durable
    // browser persistence failed instead of falsely claiming the clear was saved.
  }

  return { firstClear, treasureNew, progress, persisted };
}
