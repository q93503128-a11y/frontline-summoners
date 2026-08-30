import type { AcquisitionClass, Rarity } from '@frontline/content-schema';

export const RECRUITMENT_COST_PER_PULL = 100;

const LEVEL_UP_GOLD_COST_BY_TARGET_LEVEL: readonly number[] = [
  0, 0,
  100, 130, 160, 190, 220, 250, 280, 310, 340,
  450, 500, 550, 600, 650, 700, 750, 800, 850, 900,
  1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000,
  3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000,
  9000, 10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000,
];

const DUPLICATE_DISMANTLE_SOUL_ESSENCE: Readonly<Record<Rarity, number>> = {
  C: 4,
  B: 8,
  A: 20,
  S: 70,
  SS: 220,
};

const PLUS_LEVEL_SOUL_ESSENCE_COST: Readonly<Record<Rarity, number>> = {
  C: 16,
  B: 32,
  A: 80,
  S: 280,
  SS: 880,
};

export function getRecruitmentCost(count: number): number {
  if (!Number.isInteger(count) || count <= 0) throw new Error('recruit count must be a positive integer');
  return count * RECRUITMENT_COST_PER_PULL;
}

export function getLevelUpgradeGoldCost(currentLevel: number, targetLevel: number): number {
  if (!Number.isInteger(currentLevel) || !Number.isInteger(targetLevel)) throw new Error('character levels must be integers');
  if (currentLevel < 1 || currentLevel > 50 || targetLevel < currentLevel || targetLevel > 50) throw new Error('character level upgrade range must stay within Lv1..50');
  let total = 0;
  for (let level = currentLevel + 1; level <= targetLevel; level += 1) total += LEVEL_UP_GOLD_COST_BY_TARGET_LEVEL[level] ?? 0;
  return total;
}

export function getDuplicateDismantleSoulEssence(rarity: Rarity): number {
  return DUPLICATE_DISMANTLE_SOUL_ESSENCE[rarity];
}

export function getPlusLevelSoulEssenceCost(acquisitionClass: AcquisitionClass, rarity: Rarity | null): number {
  if (acquisitionClass === 'STORY') return 80;
  if (rarity === null) return 80;
  return PLUS_LEVEL_SOUL_ESSENCE_COST[rarity];
}
