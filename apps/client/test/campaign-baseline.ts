import {
  getBaseWeaponCooldownRemaining,
  getCooldownRemaining,
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

export interface CampaignBaselineTelemetry {
  readonly firstSpawnTick: number | null;
  readonly spawnCount: number;
  readonly upgradeCount: number;
  readonly cannonCount: number;
  readonly longestEnemyPressureWithoutPlayerTicks: number;
  readonly seenPlayerIds: ReadonlySet<string>;
}

const DEPLOYMENTS_PER_ECONOMY_LEVEL = 3;

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

function alivePlayerUnitCount(state: ReturnType<typeof createPrototypeBattle>): number {
  return state.battle.units.filter((unit) => unit.team === 'PLAYER' && unit.state !== 'DYING').length;
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
  const targetSupplyLevel = targetSupplyLevelForStage(stageIndex, state);
  const seenEnemyIds = new Set<string>();
  const seenPlayerIds = new Set<string>();

  let rosterCursor = 0;
  let firstSpawnTick: number | null = null;
  let spawnCount = 0;
  let upgradeCount = 0;
  let cannonCount = 0;
  let currentEnemyPressureWithoutPlayerTicks = 0;
  let longestEnemyPressureWithoutPlayerTicks = 0;

  const recordSpawn = (slotId: string): boolean => {
    const result = trySpawnPlayerUnit(state, slotId);
    if (!result.ok) return false;
    spawnCount += 1;
    firstSpawnTick ??= state.battle.tick;
    return true;
  };

  const advancePastCoolingSlots = (): void => {
    for (let offset = 0; offset < state.playerSlots.length; offset += 1) {
      const index = (rosterCursor + offset) % state.playerSlots.length;
      const slot = state.playerSlots[index]!;
      if (getCooldownRemaining(state, slot.slotId) === 0) {
        rosterCursor = index;
        return;
      }
    }
  };

  for (let step = 0; step < maxTicks && state.battle.winner === null; step += 1) {
    advancePastCoolingSlots();
    const targetSlot = state.playerSlots[rosterCursor]!;
    const currentWallet = getCurrentSupplyLevel(state).maxSupply;

    // Do not rush worker/economy levels before fielding troops. Each additional planned economy
    // level requires another three real deployments first, so the test models the same production
    // versus investment tradeoff expected from a human player instead of abandoning the frontline.
    const deploymentUnlockedEconomyLevel = 1 + Math.floor(spawnCount / DEPLOYMENTS_PER_ECONOMY_LEVEL);
    const plannedEconomyLevel = Math.min(targetSupplyLevel, deploymentUnlockedEconomyLevel);
    const targetNeedsWalletUpgrade = targetSlot.cost > currentWallet;
    const shouldInvestEconomy = state.supplyLevel < plannedEconomyLevel || targetNeedsWalletUpgrade;

    if (shouldInvestEconomy) {
      const next = getNextSupplyLevel(state);
      if (next && state.supply >= next.upgradeCost) {
        const upgraded = tryUpgradeSupply(state);
        if (upgraded.ok) upgradeCount += 1;
      }
    } else if (state.supply >= targetSlot.cost && getCooldownRemaining(state, targetSlot.slotId) === 0) {
      if (recordSpawn(targetSlot.slotId)) rosterCursor = (rosterCursor + 1) % state.playerSlots.length;
    } else if (alivePlayerUnitCount(state) === 0 && targetableEnemyCount(state) > 0) {
      // A collapsing line is the only exception to the planned roster order. Use any immediately
      // affordable ready reinforcement rather than intentionally letting the base take free hits.
      const emergency = [...state.playerSlots]
        .filter((slot) => slot.cost <= state.supply && getCooldownRemaining(state, slot.slotId) === 0)
        .sort((a, b) => b.cost - a.cost || a.slotId.localeCompare(b.slotId))[0];
      if (emergency) recordSpawn(emergency.slotId);
    }

    const enemies = targetableEnemyCount(state);
    const baseRatio = state.battle.bases.PLAYER.hp / state.battle.bases.PLAYER.maxHp;
    if (
      getBaseWeaponCooldownRemaining(state) === 0 &&
      (enemies >= (options.cannonEnemyCount ?? 3) || (enemies >= 1 && baseRatio < options.cannonBaseRatio))
    ) {
      const fired = tryFireBaseWeapon(state);
      if (fired.ok) cannonCount += 1;
    }

    stepPlayableBattle(state);
    for (const unit of state.battle.units) {
      if (unit.team === 'ENEMY') seenEnemyIds.add(unit.definition.id);
      if (unit.team === 'PLAYER') seenPlayerIds.add(unit.definition.id);
    }

    if (targetableEnemyCount(state) > 0 && alivePlayerUnitCount(state) === 0) {
      currentEnemyPressureWithoutPlayerTicks += 1;
      longestEnemyPressureWithoutPlayerTicks = Math.max(
        longestEnemyPressureWithoutPlayerTicks,
        currentEnemyPressureWithoutPlayerTicks,
      );
    } else {
      currentEnemyPressureWithoutPlayerTicks = 0;
    }
  }

  const telemetry: CampaignBaselineTelemetry = {
    firstSpawnTick,
    spawnCount,
    upgradeCount,
    cannonCount,
    longestEnemyPressureWithoutPlayerTicks,
    seenPlayerIds,
  };

  return {
    state,
    unlockedSlotIds,
    ownedTreasureIds,
    targetSupplyLevel,
    seenEnemyIds,
    finalSupplyLevel: getCurrentSupplyLevel(state),
    telemetry,
  };
}
