import type { ResourceAmounts } from './resource-ledger.ts';

export const ENDLESS_RECORD_REWARD_CAP_MINUTE = 20;
export const BOSS_RUSH_REWARD_CAP_DEFEATED = 9;

export interface RecordProfileHonorProgress {
  readonly endlessBestReachedMinute: number;
  readonly bossRushBestDefeated: number;
}

export interface RecordProfileHonorDefinition {
  readonly id: string;
  readonly mode: 'ENDLESS_FRONT' | 'BOSS_RUSH';
  readonly threshold: number;
  readonly cosmeticId: string;
  readonly name: string;
}

/**
 * Profile honors intentionally sit above the basic Record achievement ladder.
 * They are derived from durable Record high-water marks and are not repeatable rewards.
 * Thresholds remain DESIGN_TARGET until long-run human balance QA is complete.
 */
export const RECORD_PROFILE_HONORS: readonly RecordProfileHonorDefinition[] = [
  { id: 'record_honor_endless_12', mode: 'ENDLESS_FRONT', threshold: 12, cosmeticId: 'banner_endless_depth', name: '심층 전선' },
  { id: 'record_honor_endless_15', mode: 'ENDLESS_FRONT', threshold: 15, cosmeticId: 'frame_endless_abyss', name: '끝없는 심연' },
  { id: 'record_honor_bossrush_complete', mode: 'BOSS_RUSH', threshold: BOSS_RUSH_REWARD_CAP_DEFEATED, cosmeticId: 'emblem_bossrush_complete', name: '보스 러시 제패' },
] as const;

function normalizedHonorProgress(progress: RecordProfileHonorProgress): RecordProfileHonorProgress {
  return {
    endlessBestReachedMinute: Math.max(0, Math.floor(progress.endlessBestReachedMinute)),
    bossRushBestDefeated: Math.max(0, Math.min(BOSS_RUSH_REWARD_CAP_DEFEATED, Math.floor(progress.bossRushBestDefeated))),
  };
}

function honorReached(definition: RecordProfileHonorDefinition, progress: RecordProfileHonorProgress): boolean {
  return definition.mode === 'ENDLESS_FRONT'
    ? progress.endlessBestReachedMinute >= definition.threshold
    : progress.bossRushBestDefeated >= definition.threshold;
}

export function getRecordProfileHonorIds(progress: RecordProfileHonorProgress): readonly string[] {
  const normalized = normalizedHonorProgress(progress);
  return RECORD_PROFILE_HONORS.filter((definition) => honorReached(definition, normalized)).map((definition) => definition.cosmeticId);
}

export function getNewRecordProfileHonorIds(
  previous: RecordProfileHonorProgress,
  next: RecordProfileHonorProgress,
): readonly string[] {
  const before = new Set(getRecordProfileHonorIds(previous));
  return getRecordProfileHonorIds(next).filter((cosmeticId) => !before.has(cosmeticId));
}

export const ENDLESS_RECORD_REWARD_BY_MINUTE: Readonly<Record<number, ResourceAmounts>> = {
  1: { gold: 800 },
  2: { gold: 1200, sweep_ticket: 1 },
  3: { gold: 1600, evo_fragment: 2 },
  4: { gold: 2000, evo_fragment: 2, sweep_ticket: 1 },
  5: { gold: 2500, evo_fragment: 3, sweep_ticket: 1 },
  6: { summon_crystal: 50, soul_essence: 40 },
  7: { summon_crystal: 60, evo_core: 1 },
  8: { summon_crystal: 70, soul_essence: 60 },
  9: { summon_crystal: 80, evo_core: 1 },
  10: { summon_crystal: 100, evo_crown: 1 },
  11: { summon_crystal: 40, soul_essence: 60 },
  12: { evo_core: 1 },
  13: { summon_crystal: 50, soul_essence: 70 },
  14: { summon_crystal: 50, sweep_ticket: 1 },
  15: { evo_crown: 1 },
  16: { soul_essence: 80 },
  17: { summon_crystal: 60 },
  18: { evo_core: 1 },
  19: { soul_essence: 100 },
  20: { summon_crystal: 100, evo_crown: 1 },
};

export const BOSS_RUSH_REWARD_BY_DEFEATED: Readonly<Record<number, ResourceAmounts>> = {
  1: { gold: 1500 },
  2: { gold: 2500 },
  3: { evo_fragment: 4 },
  4: { evo_core: 1 },
  5: { summon_crystal: 75 },
  6: { summon_crystal: 100, soul_essence: 60 },
  7: { evo_core: 2, soul_essence: 80 },
  8: { evo_crown: 1, summon_crystal: 120 },
  9: { summon_crystal: 200, evo_crown: 1, sweep_ticket: 3 },
};

function addReward(total: Record<string, number>, reward: ResourceAmounts): void {
  for (const [resourceId, amount] of Object.entries(reward)) {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) continue;
    total[resourceId] = (total[resourceId] ?? 0) + Math.floor(amount);
  }
}

function rewardRange(
  table: Readonly<Record<number, ResourceAmounts>>,
  exclusiveFrom: number,
  inclusiveTo: number,
  cap: number,
): ResourceAmounts {
  const from = Math.max(0, Math.floor(exclusiveFrom));
  const to = Math.min(cap, Math.max(0, Math.floor(inclusiveTo)));
  if (to <= from) return {};
  const total: Record<string, number> = {};
  for (let boundary = from + 1; boundary <= to; boundary += 1) addReward(total, table[boundary] ?? {});
  return total as ResourceAmounts;
}

export function getEndlessRecordMilestoneReward(exclusiveFromMinute: number, inclusiveToMinute: number): ResourceAmounts {
  return rewardRange(ENDLESS_RECORD_REWARD_BY_MINUTE, exclusiveFromMinute, inclusiveToMinute, ENDLESS_RECORD_REWARD_CAP_MINUTE);
}

export function getBossRushMilestoneReward(exclusiveFromDefeated: number, inclusiveToDefeated: number): ResourceAmounts {
  return rewardRange(BOSS_RUSH_REWARD_BY_DEFEATED, exclusiveFromDefeated, inclusiveToDefeated, BOSS_RUSH_REWARD_CAP_DEFEATED);
}
