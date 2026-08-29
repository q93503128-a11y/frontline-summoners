import type { ResourceAmounts } from '@frontline/sim/resource-ledger';

export interface SpecialResourceRewardDefinition {
  readonly stageId: string;
  readonly repeatReward: ResourceAmounts;
  readonly firstClearBonus: ResourceAmounts;
}

const REWARDS: readonly SpecialResourceRewardDefinition[] = [
  { stageId: 'resource_gold_01', repeatReward: { gold: 1200 }, firstClearBonus: { gold: 1800 } },
  { stageId: 'resource_gold_02', repeatReward: { gold: 2600 }, firstClearBonus: { gold: 3400 } },
  { stageId: 'resource_gold_03', repeatReward: { gold: 5200 }, firstClearBonus: { gold: 6800 } },
  { stageId: 'resource_gold_04', repeatReward: { gold: 9000 }, firstClearBonus: { gold: 11000 } },
  { stageId: 'resource_gold_05', repeatReward: { gold: 15000 }, firstClearBonus: { gold: 18000 } },

  { stageId: 'resource_soul_01', repeatReward: { soul_essence: 45 }, firstClearBonus: { soul_essence: 60 } },
  { stageId: 'resource_soul_02', repeatReward: { soul_essence: 90 }, firstClearBonus: { soul_essence: 110 } },
  { stageId: 'resource_soul_03', repeatReward: { soul_essence: 180 }, firstClearBonus: { soul_essence: 220 } },
  { stageId: 'resource_soul_04', repeatReward: { soul_essence: 320 }, firstClearBonus: { soul_essence: 380 } },

  { stageId: 'resource_evolution_01', repeatReward: { evo_fragment: 5, gold: 450 }, firstClearBonus: { evo_fragment: 5, gold: 550 } },
  { stageId: 'resource_evolution_02', repeatReward: { evo_fragment: 8, evo_core: 1, gold: 800 }, firstClearBonus: { evo_fragment: 8, evo_core: 1, gold: 900 } },
  { stageId: 'resource_evolution_03', repeatReward: { evo_fragment: 12, evo_core: 2, gold: 1400 }, firstClearBonus: { evo_fragment: 12, evo_core: 2, gold: 1600 } },
  { stageId: 'resource_evolution_04', repeatReward: { evo_fragment: 17, evo_core: 3, evo_crown: 1, gold: 2400 }, firstClearBonus: { evo_fragment: 17, evo_core: 3, evo_crown: 1, gold: 2600 } },
  { stageId: 'resource_evolution_05', repeatReward: { evo_fragment: 25, evo_core: 5, evo_crown: 1, gold: 4000 }, firstClearBonus: { evo_fragment: 25, evo_core: 5, evo_crown: 1, gold: 5000 } },

  { stageId: 'resource_starlight_01', repeatReward: { summon_crystal: 20 }, firstClearBonus: { summon_crystal: 30 } },
  { stageId: 'resource_starlight_02', repeatReward: { summon_crystal: 35 }, firstClearBonus: { summon_crystal: 45 } },
  { stageId: 'resource_starlight_03', repeatReward: { summon_crystal: 60 }, firstClearBonus: { summon_crystal: 75 } },
  { stageId: 'resource_starlight_04', repeatReward: { summon_crystal: 95 }, firstClearBonus: { summon_crystal: 120 } },
];

if (new Set(REWARDS.map((reward) => reward.stageId)).size !== REWARDS.length) {
  throw new Error('special resource reward stage ids must be unique');
}

const BY_STAGE = new Map(REWARDS.map((reward) => [reward.stageId, reward] as const));

function addAmounts(a: ResourceAmounts, b: ResourceAmounts): ResourceAmounts {
  const result: Record<string, number> = {};
  for (const [id, amount] of Object.entries(a)) result[id] = (result[id] ?? 0) + (amount ?? 0);
  for (const [id, amount] of Object.entries(b)) result[id] = (result[id] ?? 0) + (amount ?? 0);
  return result as ResourceAmounts;
}

export const SPECIAL_RESOURCE_REWARDS = REWARDS;

export function getSpecialResourceReward(stageId: string, firstClear: boolean): ResourceAmounts {
  const reward = BY_STAGE.get(stageId);
  if (!reward) return {};
  return firstClear ? addAmounts(reward.repeatReward, reward.firstClearBonus) : reward.repeatReward;
}
