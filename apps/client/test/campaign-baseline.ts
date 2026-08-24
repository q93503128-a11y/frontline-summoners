import {
  getBaseWeaponCooldownRemaining,
  getCurrentSupplyLevel,
  getNextSupplyLevel,
  stepPlayableBattle,
  tryFireBaseWeapon,
  trySpawnPlayerUnit,
  tryUpgradeSupply,
} from '@frontline/sim/playable';
import {
  STAGES,
  createPrototypeBattle,
  getTreasureIdsForClearedStages,
  getUnlockedSlotIds,
} from '../src/prototype.ts';

export interface CampaignBaselineOptions {
  readonly maxSeconds: number;
  readonly cannonBaseRatio: number;
  readonly cannonEnemyCount?: number;
}

export function targetSupplyLevelForStage(stageIndex: number, state: ReturnType<typeof createPrototypeBattle>): number {
  const highestUnlockedCost = Math.max(...state.playerSlots.map((slot) => slot.cost));
  const walletIndex = state.supplyLevels.findIndex((level) => level.maxSupply >= highestUnlockedCost);
  if (walletIndex < 0) {
    throw new Error(`unlocked roster cost ${highestUnlockedCost} exceeds every supply wallet tier`);
  }
  const walletRequired = walletIndex + 1;
  const economyPacing = stageIndex >= 16 ? 3 : stageIndex >= 7 ? 2 : 1;
  return Math.min(state.supplyLevels.length, Math.max(walletRequired, economyPacing));
}

function targetableEnemyCount(state: ReturnType<typeof createPrototypeBattle>): number {
  return state.battle.units.filter((unit) =>
    unit.team === 'ENEMY' && unit.state !== 'DYING' && unit.state !== 'NATURAL_KNOCKBACK'
  ).length;
}

export function autoPlayCampaignStage(
  stageIndex: number,
  clearedStageIds: readonly string[],
  options: CampaignBaselineOptions,
) {
  const stage = STAGES[stageIndex]!;
  const unlockedSlotIds = getUnlockedSlotIds(clearedStageIds);
  const ownedTreasureIds = getTreasureIdsForClearedStages(clearedStageIds);
  const state = createPrototypeBattle(stage.id, unlockedSlotIds, ownedTreasureIds);
  const maxTicks = options.maxSeconds * 30;
  const slotPriority = [...state.playerSlots].sort((a, b) => b.cost - a.cost || a.slotId.localeCompare(b.slotId));
  const targetSupplyLevel = targetSupplyLevelForStage(stageIndex, state);
  const seenEnemyIds = new Set<string>();

  for (let step = 0; step < maxTicks && state.battle.winner === null; step += 1) {
    let reservingForUpgrade = false;
    if (state.supplyLevel < targetSupplyLevel) {
      const next = getNextSupplyLevel(state);
      if (next) {
        if (state.supply >= next.upgradeCost) {
          tryUpgradeSupply(state);
        } else {
          // Deliberately save instead of continuously spending the wallet down.
          // This mirrors the strategic choice the real player must make in the scarcer economy.
          reservingForUpgrade = true;
        }
      }
    }

    if (!reservingForUpgrade) {
      for (const slot of slotPriority) trySpawnPlayerUnit(state, slot.slotId);
    }

    const enemies = targetableEnemyCount(state);
    const baseRatio = state.battle.bases.PLAYER.hp / state.battle.bases.PLAYER.maxHp;
    if (
      getBaseWeaponCooldownRemaining(state) === 0 &&
      (enemies >= (options.cannonEnemyCount ?? 3) || (enemies >= 1 && baseRatio < options.cannonBaseRatio))
    ) {
      tryFireBaseWeapon(state);
    }

    stepPlayableBattle(state);
    for (const unit of state.battle.units) {
      if (unit.team === 'ENEMY') seenEnemyIds.add(unit.definition.id);
    }
  }

  return {
    state,
    unlockedSlotIds,
    ownedTreasureIds,
    targetSupplyLevel,
    seenEnemyIds,
    finalSupplyLevel: getCurrentSupplyLevel(state),
  };
}
