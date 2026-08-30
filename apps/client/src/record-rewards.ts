import type { ResourceAmounts } from '@frontline/sim/resource-ledger';

/**
 * DESIGN_TARGET reward table for v1 record modes.
 *
 * The canonical contract is the important part here: rewards are granted only
 * for newly crossed record boundaries, never for repeated farming. Exact
 * amounts remain balance-tunable until human economy playtests are LOCKED.
 */
export const ENDLESS_RECORD_REWARD_CAP_MINUTE = 20;
export const BOSS_RUSH_REWARD_CAP_DEFEATED = 9;

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
