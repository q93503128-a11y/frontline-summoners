import {
  META_RESOURCE_IDS,
  getResourceBalance,
  grantResources,
  normalizeResourceLedger,
  type MetaResourceId,
  type ResourceAmounts,
  type ResourceLedger,
} from '@frontline/sim/resource-ledger';
import { createFullPeriodicRewardChargeMap } from '@frontline/sim/periodic-special';
import { clearLegacyPeriodicSpecialChargeState } from './special-rewards.ts';
import { getGuestSelectedBaseWeaponId, loadGuestProgress, type GuestProgress } from './save.ts';

const DB_NAME = 'frontline-summoners';
const STORE_NAME = 'guest-progress';
const KEY = 'progress';
const ACHIEVEMENT_PROFILE_KEY = 'frontline-summoners:achievement-profile:v1';
const GUEST_MIGRATION_MARKER_KEY = 'frontline.guest.migratedToAccount.v1';
const DEVELOPER_SANDBOX_MARKER_KEY = 'frontline-summoners:developer-resource-sandbox:v1';

export const GUEST_DEVELOPER_RESOURCE_CODE = 'FRONTLINE-DEV-INFINITE';
export const GUEST_DEVELOPER_RESOURCE_BALANCE = 999_999_999;

const EMPTY_RECORD_PROGRESS = {
  endlessBestTimeMs: 0,
  endlessBestReachedMinute: 0,
  endlessRewardedMinute: 0,
  bossRushBestDefeated: 0,
  bossRushRewardedDefeated: 0,
} as const;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'));
  });
}

async function writeGuestProgress(progress: GuestProgress, resourceLedgerById: ResourceLedger): Promise<void> {
  const stored = {
    schemaVersion: 15,
    clearedStageIds: progress.clearedStageIds,
    normalClearSourceByStage: progress.normalClearSourceByStage ?? {},
    mainRewardedStageIds: progress.mainRewardedStageIds ?? [],
    specialClearedStageIds: progress.specialClearedStageIds,
    permanentRewardIds: progress.permanentRewardIds,
    discoveredEnemyIds: progress.discoveredEnemyIds ?? [],
    ownedRecruitmentCharacterIds: progress.ownedRecruitmentCharacterIds ?? [],
    recruitmentProgressByBanner: progress.recruitmentProgressByBanner ?? {},
    characterProgressById: progress.characterProgressById ?? {},
    resourceLedgerById,
    periodicRewardChargeByCollection: progress.periodicRewardChargeByCollection ?? createFullPeriodicRewardChargeMap(),
    recordModeProgress: progress.recordModeProgress ?? EMPTY_RECORD_PROGRESS,
    selectedBaseWeaponId: getGuestSelectedBaseWeaponId(progress),
    ...(progress.deckSlotIds === undefined ? {} : { deckSlotIds: progress.deckSlotIds }),
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(stored, KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { const error = tx.error ?? new Error('indexedDB write failed'); db.close(); reject(error); };
    tx.onabort = () => { const error = tx.error ?? new Error('indexedDB write aborted'); db.close(); reject(error); };
  });
}

async function deleteGuestProgress(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { const error = tx.error ?? new Error('indexedDB guest reset failed'); db.close(); reject(error); };
    tx.onabort = () => { const error = tx.error ?? new Error('indexedDB guest reset aborted'); db.close(); reject(error); };
  });
}

function removeLocalStorageKey(key: string): void {
  try { globalThis.localStorage?.removeItem(key); } catch { /* guest reset remains best-effort outside durable progress */ }
}

function setDeveloperSandboxMarker(): void {
  try { globalThis.localStorage?.setItem(DEVELOPER_SANDBOX_MARKER_KEY, 'enabled'); } catch { /* marker is defense-in-depth */ }
}

export function isGuestDeveloperResourceSandboxActive(): boolean {
  try { return globalThis.localStorage?.getItem(DEVELOPER_SANDBOX_MARKER_KEY) === 'enabled'; } catch { return false; }
}

export async function resetGuestLocalAccountData(): Promise<boolean> {
  try {
    await deleteGuestProgress();
    clearLegacyPeriodicSpecialChargeState();
    removeLocalStorageKey(ACHIEVEMENT_PROFILE_KEY);
    removeLocalStorageKey(GUEST_MIGRATION_MARKER_KEY);
    removeLocalStorageKey(DEVELOPER_SANDBOX_MARKER_KEY);
    return true;
  } catch {
    return false;
  }
}

export interface GuestDeveloperResourceResult {
  readonly activated: boolean;
  readonly balances: Readonly<Record<MetaResourceId, number>>;
}

export async function applyGuestDeveloperResourceCode(code: string): Promise<GuestDeveloperResourceResult> {
  if (code.trim() !== GUEST_DEVELOPER_RESOURCE_CODE) return { activated: false, balances: emptyBalances() };

  const progress = await loadGuestProgress();
  const before = normalizeResourceLedger(progress.resourceLedgerById ?? {});
  const grants: Partial<Record<MetaResourceId, number>> = {};
  for (const id of META_RESOURCE_IDS) {
    const current = getResourceBalance(before, id);
    if (current < GUEST_DEVELOPER_RESOURCE_BALANCE) grants[id] = GUEST_DEVELOPER_RESOURCE_BALANCE - current;
  }
  const resourceLedgerById = grantResources(before, grants as ResourceAmounts);
  await writeGuestProgress(progress, resourceLedgerById);
  setDeveloperSandboxMarker();

  const balances = {} as Record<MetaResourceId, number>;
  for (const id of META_RESOURCE_IDS) balances[id] = getResourceBalance(resourceLedgerById, id);
  return { activated: true, balances };
}

function emptyBalances(): Readonly<Record<MetaResourceId, number>> {
  const result = {} as Record<MetaResourceId, number>;
  for (const id of META_RESOURCE_IDS) result[id] = 0;
  return result;
}

export const __guestMaintenanceTestOnly = {
  DB_NAME,
  STORE_NAME,
  KEY,
  ACHIEVEMENT_PROFILE_KEY,
  GUEST_MIGRATION_MARKER_KEY,
  DEVELOPER_SANDBOX_MARKER_KEY,
};
