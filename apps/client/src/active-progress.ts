import { getAccountClientState, type AccountClientState } from './account-network.ts';
import { syncActiveVisualForms } from './active-visual-forms.ts';
import { loadGuestProgress, type GuestProgress } from './save.ts';

export type ActiveProgressAuthority = 'GUEST_LOCAL' | 'ACCOUNT_ONLINE' | 'ACCOUNT_OFFLINE_CACHE';
export interface ActiveProgressView {
  readonly authority: ActiveProgressAuthority;
  readonly progress: GuestProgress;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(`account snapshot ${field} must be a string array`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`account snapshot ${field} must be a non-negative integer`);
  return value as number;
}

function parseRecordModeProgress(value: unknown): NonNullable<GuestProgress['recordModeProgress']> {
  if (!isRecord(value)) throw new Error('account snapshot recordModeProgress must be an object');
  return {
    endlessBestTimeMs: nonNegativeInteger(value.endlessBestTimeMs, 'recordModeProgress.endlessBestTimeMs'),
    endlessBestReachedMinute: nonNegativeInteger(value.endlessBestReachedMinute, 'recordModeProgress.endlessBestReachedMinute'),
    endlessRewardedMinute: nonNegativeInteger(value.endlessRewardedMinute, 'recordModeProgress.endlessRewardedMinute'),
    bossRushBestDefeated: nonNegativeInteger(value.bossRushBestDefeated, 'recordModeProgress.bossRushBestDefeated'),
    bossRushRewardedDefeated: nonNegativeInteger(value.bossRushRewardedDefeated, 'recordModeProgress.bossRushRewardedDefeated'),
  };
}

export function accountSnapshotToGuestProgress(snapshot: Readonly<Record<string, unknown>>): GuestProgress {
  const clearedStageIds = stringArray(snapshot.clearedStageIds, 'clearedStageIds');
  const specialClearedStageIds = stringArray(snapshot.specialClearedStageIds, 'specialClearedStageIds');
  const permanentRewardIds = stringArray(snapshot.permanentRewardIds, 'permanentRewardIds');
  const discoveredEnemyIds = stringArray(snapshot.discoveredEnemyIds ?? [], 'discoveredEnemyIds');
  const ownedRecruitmentCharacterIds = stringArray(snapshot.ownedRecruitmentCharacterIds ?? [], 'ownedRecruitmentCharacterIds');
  const deckSlotIds = stringArray(snapshot.deckSlotIds ?? [], 'deckSlotIds');
  if (!isRecord(snapshot.characterProgressById)) throw new Error('account snapshot characterProgressById must be an object');
  if (!isRecord(snapshot.resourceLedgerById)) throw new Error('account snapshot resourceLedgerById must be an object');
  if (!isRecord(snapshot.periodicRewardChargeByCollection)) throw new Error('account snapshot periodicRewardChargeByCollection must be an object');
  if (!isRecord(snapshot.normalClearSourceByStage)) throw new Error('account snapshot normalClearSourceByStage must be an object');
  if (!Array.isArray(snapshot.mainRewardedStageIds)) throw new Error('account snapshot mainRewardedStageIds must be an array');
  if (typeof snapshot.selectedBaseWeaponId !== 'string') throw new Error('account snapshot selectedBaseWeaponId must be a string');

  return {
    clearedStageIds,
    normalClearSourceByStage: snapshot.normalClearSourceByStage as NonNullable<GuestProgress['normalClearSourceByStage']>,
    mainRewardedStageIds: stringArray(snapshot.mainRewardedStageIds, 'mainRewardedStageIds'),
    specialClearedStageIds,
    permanentRewardIds,
    discoveredEnemyIds,
    ownedRecruitmentCharacterIds,
    characterProgressById: snapshot.characterProgressById as NonNullable<GuestProgress['characterProgressById']>,
    deckSlotIds,
    selectedBaseWeaponId: snapshot.selectedBaseWeaponId as NonNullable<GuestProgress['selectedBaseWeaponId']>,
    resourceLedgerById: snapshot.resourceLedgerById as NonNullable<GuestProgress['resourceLedgerById']>,
    periodicRewardChargeByCollection: snapshot.periodicRewardChargeByCollection as NonNullable<GuestProgress['periodicRewardChargeByCollection']>,
    recordModeProgress: parseRecordModeProgress(snapshot.recordModeProgress),
  };
}

function accountView(state: Extract<AccountClientState, { kind: 'AUTHENTICATED_ONLINE' | 'AUTHENTICATED_OFFLINE_CACHE' }>): ActiveProgressView {
  if (!state.remote) throw new Error('authenticated account has no readable server snapshot');
  return {
    authority: state.kind === 'AUTHENTICATED_ONLINE' ? 'ACCOUNT_ONLINE' : 'ACCOUNT_OFFLINE_CACHE',
    progress: accountSnapshotToGuestProgress(state.remote.snapshot),
  };
}

function syncPresentationAuthority(view: ActiveProgressView): ActiveProgressView {
  syncActiveVisualForms(view.progress.characterProgressById);
  return view;
}

export async function loadActiveProgress(): Promise<ActiveProgressView> {
  const state = getAccountClientState();
  if (state.kind === 'GUEST_LOCAL') {
    return syncPresentationAuthority({ authority: 'GUEST_LOCAL', progress: await loadGuestProgress() });
  }
  return syncPresentationAuthority(accountView(state));
}

export function getCurrentActiveProgress(): ActiveProgressView | null {
  const state = getAccountClientState();
  if (state.kind === 'GUEST_LOCAL') return null;
  return syncPresentationAuthority(accountView(state));
}
