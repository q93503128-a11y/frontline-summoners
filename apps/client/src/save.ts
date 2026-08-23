export interface GuestProgress {
  readonly clearedStageIds: readonly string[];
  readonly treasureIds: readonly string[];
}

interface StoredGuestProgress extends GuestProgress {
  readonly schemaVersion: number;
}

const DB_NAME = 'frontline-summoners';
const STORE_NAME = 'guest-progress';
const KEY = 'progress';
const SCHEMA_VERSION = 2;
const EMPTY_PROGRESS: GuestProgress = { clearedStageIds: [], treasureIds: [] };

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

export async function loadGuestProgress(): Promise<GuestProgress> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
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
  } catch {
    return EMPTY_PROGRESS;
  }
}

export async function recordStageClear(stageId: string, treasureId: string): Promise<{ firstClear: boolean; treasureNew: boolean; progress: GuestProgress }> {
  const before = await loadGuestProgress();
  const cleared = new Set(before.clearedStageIds);
  const treasures = new Set(before.treasureIds);
  const firstClear = !cleared.has(stageId);
  const treasureNew = !treasures.has(treasureId);
  cleared.add(stageId);
  treasures.add(treasureId);
  const progress: GuestProgress = { clearedStageIds: [...cleared], treasureIds: [...treasures] };
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
  } catch {
    // 플레이 자체는 저장 장애 때문에 막지 않는다. 로그인 계정 정본 저장은 서버 단계에서 별도 처리한다.
  }

  return { firstClear, treasureNew, progress };
}
