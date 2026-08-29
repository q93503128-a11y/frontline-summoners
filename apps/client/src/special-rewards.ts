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
  { stageId: 'special_glutton_01', repeatReward: { gold: 250 }, firstClearBonus: { gold: 750, evo_fragment: 2 } },
  { stageId: 'special_glutton_02', repeatReward: { gold: 400 }, firstClearBonus: { gold: 1200, evo_fragment: 4, evo_core: 1 } },
  { stageId: 'special_glutton_03', repeatReward: { gold: 650 }, firstClearBonus: { gold: 2200, evo_fragment: 8, evo_core: 2 } },
  { stageId: 'special_glutton_04', repeatReward: { gold: 900 }, firstClearBonus: { gold: 4500, evo_core: 3, evo_crown: 1, summon_crystal: 80 } },
  { stageId: 'special_undead_01', repeatReward: { gold: 250 }, firstClearBonus: { gold: 700, evo_fragment: 3 } },
  { stageId: 'special_undead_02', repeatReward: { gold: 400 }, firstClearBonus: { gold: 1100, evo_fragment: 5, evo_core: 1 } },
  { stageId: 'special_undead_03', repeatReward: { gold: 650 }, firstClearBonus: { gold: 1800, soul_essence: 120, evo_core: 2 } },
  { stageId: 'special_undead_04', repeatReward: { gold: 900 }, firstClearBonus: { gold: 3200, soul_essence: 250, evo_core: 3, evo_crown: 1 } },
  { stageId: 'special_glass_01', repeatReward: { gold: 300 }, firstClearBonus: { gold: 900, evo_fragment: 4 } },
  { stageId: 'special_glass_02', repeatReward: { gold: 450 }, firstClearBonus: { gold: 1300, evo_core: 1, summon_crystal: 25 } },
  { stageId: 'special_glass_03', repeatReward: { gold: 700 }, firstClearBonus: { gold: 2100, evo_core: 2, summon_crystal: 50 } },
  { stageId: 'special_glass_04', repeatReward: { gold: 950 }, firstClearBonus: { gold: 3600, evo_core: 3, evo_crown: 1, summon_crystal: 90 } },
  { stageId: 'special_mechcastle_01', repeatReward: { gold: 350 }, firstClearBonus: { gold: 1200, evo_core: 1 } },
  { stageId: 'special_mechcastle_02', repeatReward: { gold: 500 }, firstClearBonus: { gold: 1800, evo_core: 2 } },
  { stageId: 'special_mechcastle_03', repeatReward: { gold: 750 }, firstClearBonus: { gold: 2600, evo_core: 3 } },
  { stageId: 'special_mechcastle_04', repeatReward: { gold: 1000 }, firstClearBonus: { gold: 4500, evo_core: 4, evo_crown: 1 } },
  { stageId: 'special_anomaly_01', repeatReward: { gold: 350 }, firstClearBonus: { gold: 1000, summon_crystal: 30 } },
  { stageId: 'special_anomaly_02', repeatReward: { gold: 550 }, firstClearBonus: { gold: 1600, evo_core: 1, summon_crystal: 45 } },
  { stageId: 'special_anomaly_03', repeatReward: { gold: 800 }, firstClearBonus: { gold: 2400, evo_core: 2, summon_crystal: 70 } },
  { stageId: 'special_anomaly_04', repeatReward: { gold: 1050 }, firstClearBonus: { gold: 4000, evo_core: 3, evo_crown: 1, summon_crystal: 120 } },
  { stageId: 'special_echoes_01', repeatReward: { gold: 600 }, firstClearBonus: { gold: 3000, evo_core: 2, summon_crystal: 30 } },
  { stageId: 'special_echoes_02', repeatReward: { gold: 800 }, firstClearBonus: { gold: 4500, evo_core: 3, evo_crown: 1, summon_crystal: 60 } },
  { stageId: 'special_echoes_03', repeatReward: { gold: 1100 }, firstClearBonus: { gold: 8000, evo_core: 5, evo_crown: 2, summon_crystal: 150 } },

  { stageId: 'special_five_banners_01', repeatReward: { gold: 300 }, firstClearBonus: { gold: 900, evo_fragment: 3 } },
  { stageId: 'special_five_banners_02', repeatReward: { gold: 500 }, firstClearBonus: { gold: 1600, evo_fragment: 5, evo_core: 1 } },
  { stageId: 'special_light_purse_01', repeatReward: { gold: 350 }, firstClearBonus: { gold: 1000, evo_fragment: 2, summon_crystal: 20 } },
  { stageId: 'special_light_purse_02', repeatReward: { gold: 550 }, firstClearBonus: { gold: 1800, evo_core: 1, summon_crystal: 35 } },

  { stageId: 'event_summer_01_01', repeatReward: { gold: 150 }, firstClearBonus: { gold: 350, summon_crystal: 10 } },
  { stageId: 'event_summer_01_02', repeatReward: { gold: 220 }, firstClearBonus: { gold: 500, evo_fragment: 2, summon_crystal: 12 } },
  { stageId: 'event_summer_01_03', repeatReward: { gold: 300 }, firstClearBonus: { gold: 750, evo_fragment: 3, summon_crystal: 15 } },
  { stageId: 'event_summer_01_04', repeatReward: { gold: 400 }, firstClearBonus: { gold: 1100, evo_fragment: 4, summon_crystal: 20 } },
  { stageId: 'event_summer_01_05', repeatReward: { gold: 550 }, firstClearBonus: { gold: 1700, evo_core: 1, summon_crystal: 30 } },
  { stageId: 'event_summer_01_06', repeatReward: { gold: 700 }, firstClearBonus: { gold: 2600, evo_core: 2, summon_crystal: 50 } },
  { stageId: 'event_zero_edge_01_01', repeatReward: { gold: 180 }, firstClearBonus: { gold: 450, summon_crystal: 12 } },
  { stageId: 'event_zero_edge_01_02', repeatReward: { gold: 260 }, firstClearBonus: { gold: 650, evo_fragment: 2, summon_crystal: 15 } },
  { stageId: 'event_zero_edge_01_03', repeatReward: { gold: 350 }, firstClearBonus: { gold: 900, evo_fragment: 3, summon_crystal: 20 } },
  { stageId: 'event_zero_edge_01_04', repeatReward: { gold: 480 }, firstClearBonus: { gold: 1400, evo_core: 1, summon_crystal: 30 } },
  { stageId: 'event_zero_edge_01_05', repeatReward: { gold: 650 }, firstClearBonus: { gold: 2300, evo_core: 2, summon_crystal: 45 } },
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
