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
  const cheapPriority = [...state.playerSlots].sort((a, b) => a.cost - b.cost || a.slotId.localeCompare(b.slotId));
  const targetSupplyLevel = targetSupplyLevelForStage(stageIndex, state);
  const seenEnemyIds = new Set<string>();
  const seenPlayerIds = new Set<string>();

  let firstSpawnTick: number | null = null;
  let spawnCount = 0;
  let upgradeCount = 0;
  let cannonCount = 0;
  let currentEnemyPressureWithoutPlayerTicks = 0;
  let longestEnemyPressureWithoutPlayerTicks = 0;

  for (let step = 0; step < maxTicks && state.battle.winner === null; step += 1) {
    let reservingForUpgrade = false;
    const alivePlayersAtDecision = alivePlayerUnitCount(state);

    // Never open a battle by staring at an empty field just to rush the wallet.
    // Once a minimal frontline exists, saving for the planned economy tier becomes a real strategic choice.
    if (state.supplyLevel < targetSupplyLevel && alivePlayersAtDecision > 0) {
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
      let spawnedThisTick = false;
      const alivePlayers = alivePlayerUnitCount(state);

      // Keep at least a tiny screen presence before saving for premium units. This prevents the old
      // baseline bug where every 50 supply was immediately burned on militia, but also avoids a new
      // opposite bug where the script waits on an empty field for one expensive unit.
      if (alivePlayers < 2) {
        for (const slot of cheapPriority) {
          const result = trySpawnPlayerUnit(state, slot.slotId);
          if (!result.ok) continue;
          spawnedThisTick = true;
          spawnCount += 1;
          firstSpawnTick ??= state.battle.tick;
          break;
        }
      } else {
        // With a frontline established, reserve for the strongest currently ready unit instead of
        // leaking the wallet into the cheapest slot every tick. If that unit is still on cooldown,
        // fall through to the next ready option so the baseline does not idle for cooldown alone.
        const wallet = getCurrentSupplyLevel(state).maxSupply;
        const strategicTarget = slotPriority.find((slot) =>
          slot.cost <= wallet && getCooldownRemaining(state, slot.slotId) === 0
        );

        if (strategicTarget) {
          if (state.supply >= strategicTarget.cost) {
            const result = trySpawnPlayerUnit(state, strategicTarget.slotId);
            if (result.ok) {
              spawnedThisTick = true;
              spawnCount += 1;
              firstSpawnTick ??= state.battle.tick;
            }
          }
          // If supply is short, intentionally reserve instead of falling through to cheap spam.
        } else {
          for (const slot of slotPriority) {
            const result = trySpawnPlayerUnit(state, slot.slotId);
            if (!result.ok) continue;
            spawnedThisTick = true;
            spawnCount += 1;
            firstSpawnTick ??= state.battle.tick;
            break;
          }
        }
      }

      void spawnedThisTick;
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
