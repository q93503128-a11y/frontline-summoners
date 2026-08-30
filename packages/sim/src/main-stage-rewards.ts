import type { ResourceAmounts } from './resource-ledger.ts';

export interface MainStageResourceRewardDefinition {
  readonly stageId: string;
  readonly firstClearReward: ResourceAmounts;
  readonly repeatReward: ResourceAmounts;
}

type StageRewardTuple = readonly [firstGold: number, summonCrystal: number, repeatGold: number];

const CHAPTER_REWARDS: readonly (readonly StageRewardTuple[])[] = [
  [
    [150, 40, 30], [180, 40, 30], [220, 40, 40], [260, 40, 50], [300, 40, 60],
    [350, 50, 70], [400, 50, 80], [450, 50, 90], [500, 50, 100], [600, 50, 120],
    [650, 60, 130], [700, 60, 140], [750, 60, 150], [800, 60, 160], [850, 60, 170],
    [900, 70, 180], [1000, 70, 200], [1100, 70, 220], [1300, 70, 260], [2000, 250, 400],
  ],
  [
    [700, 60, 140], [750, 60, 150], [800, 60, 160], [850, 60, 170], [900, 60, 180],
    [1000, 70, 200], [1100, 70, 220], [1200, 70, 240], [1300, 70, 260], [1600, 70, 320],
    [1500, 80, 300], [1600, 80, 320], [1700, 80, 340], [1800, 80, 360], [1900, 80, 380],
    [2100, 90, 420], [2300, 90, 460], [2600, 90, 520], [3000, 90, 600], [4500, 350, 900],
  ],
  [
    [1500, 80, 300], [1600, 80, 320], [1700, 80, 340], [1800, 80, 360], [1900, 80, 380],
    [2100, 90, 420], [2300, 90, 460], [2500, 90, 500], [2700, 90, 540], [3400, 90, 680],
    [3000, 100, 600], [3200, 100, 640], [3400, 100, 680], [3600, 100, 720], [3800, 100, 760],
    [4200, 110, 840], [4600, 110, 920], [5200, 110, 1040], [6000, 110, 1200], [9000, 500, 1800],
  ],
  [
    [3000, 100, 600], [3200, 100, 640], [3400, 100, 680], [3600, 100, 720], [3800, 100, 760],
    [4200, 120, 840], [4600, 120, 920], [5000, 120, 1000], [5400, 120, 1080], [6800, 120, 1360],
    [6000, 140, 1200], [6400, 140, 1280], [6800, 140, 1360], [7200, 140, 1440], [7600, 140, 1520],
    [8400, 160, 1680], [9200, 160, 1840], [10400, 160, 2080], [12000, 160, 2400], [18000, 700, 3600],
  ],
];

const MILESTONE_EXTRAS: Readonly<Record<string, ResourceAmounts>> = {
  main_01_005: { evo_fragment: 2, sweep_ticket: 1 },
  main_01_010: { evo_fragment: 4, sweep_ticket: 1 },
  main_01_015: { evo_fragment: 6, sweep_ticket: 2 },
  main_01_020: { evo_fragment: 10, evo_core: 1, sweep_ticket: 3 },
  main_02_005: { evo_fragment: 4, sweep_ticket: 1 },
  main_02_010: { evo_fragment: 8, evo_core: 1, sweep_ticket: 2 },
  main_02_015: { evo_fragment: 8, evo_core: 1, sweep_ticket: 2 },
  main_02_020: { evo_fragment: 12, evo_core: 2, sweep_ticket: 4 },
  main_03_005: { evo_fragment: 6, sweep_ticket: 2 },
  main_03_010: { evo_fragment: 10, evo_core: 2, sweep_ticket: 2 },
  main_03_015: { evo_fragment: 12, evo_core: 2, sweep_ticket: 3 },
  main_03_020: { evo_fragment: 16, evo_core: 3, evo_crown: 1, sweep_ticket: 5 },
  main_04_005: { evo_fragment: 8, evo_core: 1, sweep_ticket: 2 },
  main_04_010: { evo_fragment: 12, evo_core: 3, sweep_ticket: 3 },
  main_04_015: { evo_fragment: 16, evo_core: 4, evo_crown: 1, sweep_ticket: 4 },
  main_04_020: { evo_fragment: 20, evo_core: 5, evo_crown: 2, sweep_ticket: 7 },
};

function mergeAmounts(a: ResourceAmounts, b: ResourceAmounts): ResourceAmounts {
  const merged: Record<string, number> = {};
  for (const [id, amount] of Object.entries(a)) if (typeof amount === 'number' && amount > 0) merged[id] = (merged[id] ?? 0) + amount;
  for (const [id, amount] of Object.entries(b)) if (typeof amount === 'number' && amount > 0) merged[id] = (merged[id] ?? 0) + amount;
  return merged as ResourceAmounts;
}

const REWARDS: readonly MainStageResourceRewardDefinition[] = CHAPTER_REWARDS.flatMap((chapterRewards, chapterIndex) =>
  chapterRewards.map(([firstGold, summonCrystal, repeatGold], stageIndex) => {
    const stageId = `main_${String(chapterIndex + 1).padStart(2, '0')}_${String(stageIndex + 1).padStart(3, '0')}`;
    const baseFirst: ResourceAmounts = { gold: firstGold, summon_crystal: summonCrystal };
    return {
      stageId,
      firstClearReward: mergeAmounts(baseFirst, MILESTONE_EXTRAS[stageId] ?? {}),
      repeatReward: { gold: repeatGold },
    };
  }),
);

if (REWARDS.length !== 80) throw new Error(`main stage resource reward table must contain 80 entries, got ${REWARDS.length}`);
if (new Set(REWARDS.map((reward) => reward.stageId)).size !== REWARDS.length) throw new Error('main stage resource reward ids must be unique');

const BY_STAGE = new Map(REWARDS.map((reward) => [reward.stageId, reward] as const));

export const MAIN_STAGE_RESOURCE_REWARDS = REWARDS;

export function getMainStageResourceReward(stageId: string, firstClearReward: boolean): ResourceAmounts {
  const reward = BY_STAGE.get(stageId);
  if (!reward) throw new Error(`Unknown main stage reward id: ${stageId}`);
  return firstClearReward ? reward.firstClearReward : reward.repeatReward;
}
