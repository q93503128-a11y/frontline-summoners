import type { BaseWeaponId } from '@frontline/sim/playable';
import { getContiguousClearedStageIds } from './prototype.ts';

export interface BaseWeaponUnlockDefinition {
  readonly id: BaseWeaponId;
  readonly displayName: string;
  readonly description: string;
  readonly unlockAfterStageId?: string;
}

export const BASE_WEAPON_UNLOCKS: readonly BaseWeaponUnlockDefinition[] = [
  {
    id: 'base_weapon_front_cannon',
    displayName: '전선포격기',
    description: '전장 전체 적에게 피해를 주고 비구조 적을 밀어낸다.',
  },
  {
    id: 'base_weapon_aegis_emitter',
    displayName: '결계발진기',
    description: '사용 순간 전장에 있는 아군만 5초 동안 받는 피해 25% 감소.',
    unlockAfterStageId: 'main_02_010',
  },
  {
    id: 'base_weapon_supply_drop',
    displayName: '보급낙하기',
    description: '30F 뒤 현재 보급 상한에 비례한 보급을 즉시 획득한다.',
    unlockAfterStageId: 'main_03_010',
  },
] as const;

export function getUnlockedBaseWeaponIds(clearedStageIds: readonly string[]): readonly BaseWeaponId[] {
  const cleared = new Set(getContiguousClearedStageIds(clearedStageIds));
  return BASE_WEAPON_UNLOCKS.filter((weapon) => weapon.unlockAfterStageId === undefined || cleared.has(weapon.unlockAfterStageId)).map((weapon) => weapon.id);
}

export function isBaseWeaponUnlocked(id: BaseWeaponId, clearedStageIds: readonly string[]): boolean {
  return getUnlockedBaseWeaponIds(clearedStageIds).includes(id);
}

export function normalizeSelectedBaseWeaponId(id: string | undefined, clearedStageIds: readonly string[]): BaseWeaponId {
  const unlocked = getUnlockedBaseWeaponIds(clearedStageIds);
  return unlocked.includes(id as BaseWeaponId) ? id as BaseWeaponId : 'base_weapon_front_cannon';
}
