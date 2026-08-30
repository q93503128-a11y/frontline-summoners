import type { ResourceAmounts } from './resource-ledger.ts';
import {
  PERIODIC_REWARD_COLLECTION_IDS,
  consumePeriodicRewardCharge,
  normalizePeriodicRewardChargeMap,
  type PeriodicRewardChargeMap,
  type PeriodicRewardCollectionId,
} from './periodic-special.ts';

export interface SpecialResourceRewardDefinition {
  readonly stageId: string;
  readonly repeatReward: ResourceAmounts;
  readonly firstClearBonus: ResourceAmounts;
}

export interface PeriodicSpecialRewardDefinition {
  readonly stageId: string;
  readonly collectionId: PeriodicRewardCollectionId;
  readonly firstClearReward: ResourceAmounts;
  readonly chargedReward: ResourceAmounts;
  readonly depletedReward: ResourceAmounts;
}

export interface SpecialResourceRewardResolution {
  readonly resourceReward: ResourceAmounts;
  readonly periodicChargeMap: PeriodicRewardChargeMap;
  readonly chargeConsumed: boolean;
  readonly periodicCollectionId?: PeriodicRewardCollectionId;
}

export const PERIODIC_SPECIAL_REWARDS: readonly PeriodicSpecialRewardDefinition[] = [
  { stageId: 'special_gold_convoy_01', collectionId: 'special_gold_convoy', firstClearReward: { gold: 600, sweep_ticket: 1 }, chargedReward: { gold: 450 }, depletedReward: { gold: 90 } },
  { stageId: 'special_gold_convoy_02', collectionId: 'special_gold_convoy', firstClearReward: { gold: 1200 }, chargedReward: { gold: 850 }, depletedReward: { gold: 170 } },
  { stageId: 'special_gold_convoy_03', collectionId: 'special_gold_convoy', firstClearReward: { gold: 2600 }, chargedReward: { gold: 1900 }, depletedReward: { gold: 380 } },
  { stageId: 'special_gold_convoy_04', collectionId: 'special_gold_convoy', firstClearReward: { gold: 5000 }, chargedReward: { gold: 3600 }, depletedReward: { gold: 720 } },
  { stageId: 'special_gold_convoy_05', collectionId: 'special_gold_convoy', firstClearReward: { gold: 9000 }, chargedReward: { gold: 6500 }, depletedReward: { gold: 1300 } },
  { stageId: 'special_soul_forge_01', collectionId: 'special_soul_forge', firstClearReward: { soul_essence: 30 }, chargedReward: { soul_essence: 18 }, depletedReward: { soul_essence: 4 } },
  { stageId: 'special_soul_forge_02', collectionId: 'special_soul_forge', firstClearReward: { soul_essence: 65 }, chargedReward: { soul_essence: 40 }, depletedReward: { soul_essence: 8 } },
  { stageId: 'special_soul_forge_03', collectionId: 'special_soul_forge', firstClearReward: { soul_essence: 140 }, chargedReward: { soul_essence: 90 }, depletedReward: { soul_essence: 18 } },
  { stageId: 'special_soul_forge_04', collectionId: 'special_soul_forge', firstClearReward: { soul_essence: 300 }, chargedReward: { soul_essence: 190 }, depletedReward: { soul_essence: 38 } },
  { stageId: 'special_evolution_gate_01', collectionId: 'special_evolution_gate', firstClearReward: { evo_fragment: 12 }, chargedReward: { evo_fragment: 7 }, depletedReward: { evo_fragment: 2 } },
  { stageId: 'special_evolution_gate_02', collectionId: 'special_evolution_gate', firstClearReward: { evo_fragment: 24, evo_core: 1 }, chargedReward: { evo_fragment: 14 }, depletedReward: { evo_fragment: 3 } },
  { stageId: 'special_evolution_gate_03', collectionId: 'special_evolution_gate', firstClearReward: { evo_fragment: 40, evo_core: 3 }, chargedReward: { evo_fragment: 22, evo_core: 1 }, depletedReward: { evo_fragment: 5 } },
  { stageId: 'special_evolution_gate_04', collectionId: 'special_evolution_gate', firstClearReward: { evo_fragment: 70, evo_core: 6 }, chargedReward: { evo_fragment: 38, evo_core: 2 }, depletedReward: { evo_fragment: 8 } },
  { stageId: 'special_evolution_gate_05', collectionId: 'special_evolution_gate', firstClearReward: { evo_fragment: 120, evo_core: 12, evo_crown: 2 }, chargedReward: { evo_fragment: 65, evo_core: 5 }, depletedReward: { evo_fragment: 13, evo_core: 1 } },
  { stageId: 'special_starlight_rift_01', collectionId: 'special_starlight_rift', firstClearReward: { summon_crystal: 80 }, chargedReward: { summon_crystal: 45 }, depletedReward: { summon_crystal: 9 } },
  { stageId: 'special_starlight_rift_02', collectionId: 'special_starlight_rift', firstClearReward: { summon_crystal: 150 }, chargedReward: { summon_crystal: 85 }, depletedReward: { summon_crystal: 17 } },
  { stageId: 'special_starlight_rift_03', collectionId: 'special_starlight_rift', firstClearReward: { summon_crystal: 300 }, chargedReward: { summon_crystal: 180 }, depletedReward: { summon_crystal: 36 } },
  { stageId: 'special_starlight_rift_04', collectionId: 'special_starlight_rift', firstClearReward: { summon_crystal: 600 }, chargedReward: { summon_crystal: 350 }, depletedReward: { summon_crystal: 70 } },
];

export const SPECIAL_RESOURCE_REWARDS: readonly SpecialResourceRewardDefinition[] = [
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

const ALL_REWARD_IDS = [...PERIODIC_SPECIAL_REWARDS.map((reward) => reward.stageId), ...SPECIAL_RESOURCE_REWARDS.map((reward) => reward.stageId)];
if (new Set(ALL_REWARD_IDS).size !== ALL_REWARD_IDS.length) throw new Error('special resource reward stage ids must be unique');
const BY_STAGE = new Map(SPECIAL_RESOURCE_REWARDS.map((reward) => [reward.stageId, reward] as const));
const PERIODIC_BY_STAGE = new Map(PERIODIC_SPECIAL_REWARDS.map((reward) => [reward.stageId, reward] as const));

function addAmounts(a: ResourceAmounts, b: ResourceAmounts): ResourceAmounts {
  const result: Record<string, number> = {};
  for (const [id, amount] of Object.entries(a)) result[id] = (result[id] ?? 0) + (amount ?? 0);
  for (const [id, amount] of Object.entries(b)) result[id] = (result[id] ?? 0) + (amount ?? 0);
  return result as ResourceAmounts;
}

export function getPeriodicRewardCollectionIdForStage(stageId: string): PeriodicRewardCollectionId | undefined {
  return PERIODIC_BY_STAGE.get(stageId)?.collectionId;
}

export function resolveSpecialResourceReward(
  stageId: string,
  firstClear: boolean,
  chargeMap: PeriodicRewardChargeMap,
  nowMs = Date.now(),
): SpecialResourceRewardResolution {
  const normalizedCharges = normalizePeriodicRewardChargeMap(chargeMap, nowMs);
  const periodic = PERIODIC_BY_STAGE.get(stageId);
  if (periodic) {
    if (firstClear) {
      return {
        resourceReward: periodic.firstClearReward,
        periodicChargeMap: normalizedCharges,
        chargeConsumed: false,
        periodicCollectionId: periodic.collectionId,
      };
    }
    const consumed = consumePeriodicRewardCharge(normalizedCharges[periodic.collectionId], nowMs);
    return {
      resourceReward: consumed.consumed ? periodic.chargedReward : periodic.depletedReward,
      periodicChargeMap: { ...normalizedCharges, [periodic.collectionId]: consumed.state } as PeriodicRewardChargeMap,
      chargeConsumed: consumed.consumed,
      periodicCollectionId: periodic.collectionId,
    };
  }
  const reward = BY_STAGE.get(stageId);
  return {
    resourceReward: reward ? (firstClear ? addAmounts(reward.repeatReward, reward.firstClearBonus) : reward.repeatReward) : {},
    periodicChargeMap: normalizedCharges,
    chargeConsumed: false,
  };
}

for (const collectionId of PERIODIC_REWARD_COLLECTION_IDS) {
  if (!PERIODIC_SPECIAL_REWARDS.some((reward) => reward.collectionId === collectionId)) throw new Error(`periodic reward collection has no stages:${collectionId}`);
}
