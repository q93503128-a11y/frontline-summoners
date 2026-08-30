import {
  createFullPeriodicRewardChargeMap,
  normalizePeriodicRewardChargeMap,
  type PeriodicRewardChargeMap,
} from '@frontline/sim/periodic-special';

export {
  PERIODIC_SPECIAL_REWARDS,
  SPECIAL_RESOURCE_REWARDS,
  getPeriodicRewardCollectionIdForStage,
  resolveSpecialResourceReward,
  type PeriodicSpecialRewardDefinition,
  type SpecialResourceRewardDefinition,
  type SpecialResourceRewardResolution,
} from '@frontline/sim/special-rewards';

const LEGACY_STORAGE_KEY = 'frontline-summoners:periodic-reward-charge:v1';

/** v13 and earlier stored periodic charges separately. Save v14 imports this once, then removes it after durable persistence. */
export function readLegacyPeriodicSpecialChargeMap(nowMs = Date.now()): PeriodicRewardChargeMap | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(LEGACY_STORAGE_KEY);
    return raw ? normalizePeriodicRewardChargeMap(JSON.parse(raw), nowMs) : undefined;
  } catch {
    return undefined;
  }
}

export function clearLegacyPeriodicSpecialChargeState(): void {
  try { globalThis.localStorage?.removeItem(LEGACY_STORAGE_KEY); } catch { /* durable save remains authoritative */ }
}

export function resetPeriodicSpecialChargeStateForTests(): void {
  clearLegacyPeriodicSpecialChargeState();
}

/** Used when no historical v13 charge state exists. */
export function createDefaultPeriodicSpecialChargeMap(): PeriodicRewardChargeMap {
  return createFullPeriodicRewardChargeMap();
}
