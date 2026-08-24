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

const MIN_FRONTLINE_UNITS = 3;
const STRATEGIC_WALLET_RATIO = 0.8;

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
  const slotPriority = [...state.playerSlots].sort((a, b) => b.cost - a.cost || a.slotId.localeCompare(b.slotId));
  const targetSupplyLevel = targetSupplyLevelForStage(stageIndex, state);
  const seenEnemyIds = new Set<string>();
  const seenPlayerIds = new Set<string>();

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

  const spawnStrongestAffordableNow = (): boolean => {
    for (const slot of slotPriority) {
      if (slot.cost > state.supply || getCooldownRemaining(state, slot.slotId) > 0) continue;
      if (recordSpawn(slot.slotId)) return true;
    }
    return false;
  };

  for (let step = 0; step < maxTicks && state.battle.winner === null; step += 1) {
    const alivePlayersAtDecision = alivePlayerUnitCount(state);
    let reservingForUpgrade = false;

    // Economy investment is allowed only behind a real minimum frontline. The previous helper
    // started saving after one disposable unit, which made later stages look impossible while
    // the script itself was voluntarily abandoning the front.
    if (state.supplyLevel < targetSupplyLevel && alivePlayersAtDecision >= MIN_FRONTLINE_UNITS) {
      const next = getNextSupplyLevel(state);
      if (next) {
        if (state.supply >= next.upgradeCost) {
          const upgraded = tryUpgradeSupply(state);
          if (upgraded.ok) upgradeCount += 1;
        } else {
          reservingForUpgrade = true;
        }
      }
    }

    if (!reservingForUpgrade) {
      const alivePlayers = alivePlayerUnitCount(state);

      if (alivePlayers < MIN_FRONTLINE_UNITS) {
        // Emergency/frontline construction spends immediately, but on the strongest unit that is
        // actually affordable now rather than blindly burning every 50 supply on militia.
        spawnStrongestAffordableNow();
      } else {
        const wallet = getCurrentSupplyLevel(state).maxSupply;
        const strategicCostCeiling = Math.max(
          state.playerSlots[0]?.cost ?? 0,
          Math.floor(wallet * STRATEGIC_WALLET_RATIO),
        );
        const strategicTarget = slotPriority.find((slot) =>
          slot.cost <= strategicCostCeiling && getCooldownRemaining(state, slot.slotId) === 0
        );

        if (strategicTarget) {
          // Once the line is stable, deliberately save for a meaningful unit. Capping the target at
          // 80% of wallet capacity avoids pathological "wait for the single most expensive button"
          // behavior while still making newly unlocked roles appear in the baseline.
          if (state.supply >= strategicTarget.cost) recordSpawn(strategicTarget.slotId);
        } else {
          // All strategic choices can be on cooldown at once. In that case do not idle purely for
          // cooldown timing; spend on the best currently ready affordable reinforcement.
          spawnStrongestAffordableNow();
        }
      }
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
