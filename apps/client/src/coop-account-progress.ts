import type { BaseWeaponId } from '@frontline/sim/playable';
import { getAccountClientState } from './account-network';
import type { CoopPlayerLoadout } from './coop-network';

export interface AccountCoopClientProgress {
  readonly clearedStageIds: readonly string[];
  readonly specialClearedStageIds: readonly string[];
  readonly permanentRewardIds: readonly string[];
  readonly deckSlotIds: readonly string[];
  readonly selectedBaseWeaponId: BaseWeaponId;
  readonly characterProgressById: Readonly<Record<string, {
    readonly level: number;
    readonly plusLevel: number;
    readonly selectedFormId?: string;
  }>>;
}

const BASE_WEAPON_IDS = new Set<string>(['base_weapon_front_cannon', 'base_weapon_aegis_emitter', 'base_weapon_supply_drop']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0))] : [];
}

function progressMap(value: unknown): AccountCoopClientProgress['characterProgressById'] {
  if (!isRecord(value)) return {};
  const result: Record<string, { level: number; plusLevel: number; selectedFormId?: string }> = {};
  for (const [characterId, entry] of Object.entries(value)) {
    if (!isRecord(entry) || !Number.isInteger(entry.level) || (entry.level as number) < 1 || !Number.isInteger(entry.plusLevel) || (entry.plusLevel as number) < 0) continue;
    result[characterId] = {
      level: entry.level as number,
      plusLevel: entry.plusLevel as number,
      ...(typeof entry.selectedFormId === 'string' ? { selectedFormId: entry.selectedFormId } : {}),
    };
  }
  return result;
}

export function getAuthenticatedCoopClientProgress(): AccountCoopClientProgress | null {
  const state = getAccountClientState();
  if (state.kind !== 'AUTHENTICATED_ONLINE') return null;
  const snapshot = state.remote.snapshot;
  const selected = typeof snapshot.selectedBaseWeaponId === 'string' && BASE_WEAPON_IDS.has(snapshot.selectedBaseWeaponId)
    ? snapshot.selectedBaseWeaponId as BaseWeaponId
    : 'base_weapon_front_cannon';
  return {
    clearedStageIds: stringArray(snapshot.clearedStageIds),
    specialClearedStageIds: stringArray(snapshot.specialClearedStageIds),
    permanentRewardIds: stringArray(snapshot.permanentRewardIds),
    deckSlotIds: stringArray(snapshot.deckSlotIds).slice(0, 5),
    selectedBaseWeaponId: selected,
    characterProgressById: progressMap(snapshot.characterProgressById),
  };
}

export function accountCoopLoadout(progress: AccountCoopClientProgress): CoopPlayerLoadout {
  return {
    characters: progress.deckSlotIds.map((characterId) => {
      const meta = progress.characterProgressById[characterId];
      return {
        characterId,
        level: meta?.level ?? 1,
        plusLevel: meta?.plusLevel ?? 0,
        ...(meta?.selectedFormId === undefined ? {} : { selectedFormId: meta.selectedFormId }),
      };
    }),
    permanentRewardIds: [...progress.permanentRewardIds],
    clearedStageIds: [...progress.clearedStageIds],
  };
}
