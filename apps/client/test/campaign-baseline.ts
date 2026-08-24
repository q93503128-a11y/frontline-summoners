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
const EMERGENCY_FRONTLINE_COUNT = 1;
const STABLE_FRONTLINE_COUNT = 4;
const OPENING_ECONOMY_STAGE_INDEX = 7;
const BOSS_COUNTER_STAGE_INDEX = 15;

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

function selectReadyBossCounter(state: ReturnType<typeof createPrototypeBattle>) {
  const bossTraits = new Set(
    state.battle.units
      .filter((unit) => unit.team === 'ENEMY' && unit.state !== 'DYING' && unit.definition.traits.includes('BOSS'))
      .flatMap((unit) => unit.definition.traits),
  );
  if (bossTraits.size === 0) return undefined;

  return [...state.playerSlots]
    .filter((slot) => getCooldownRemaining(state, slot.slotId) === 0)
    .map((slot) => {
      const matchingMultiplier = slot.definition.damageBonuses
        .filter((bonus) => bossTraits.has(bonus.trait))
        .reduce((best, bonus) => Math.max(best, bonus.multiplierPermille), 0);
      if (matchingMultiplier === 0) return null;
      const cycleFrames = slot.definition.attackTiming.cycleFrames;
      const specialistScore = (slot.definition.attackDamage * matchingMultiplier) / cycleFrames;
      return { slot, specialistScore, matchingMultiplier };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((a, b) =>
      b.specialistScore - a.specialistScore ||
      b.matchingMultiplier - a.matchingMultiplier ||
      b.slot.cost - a.slot.cost ||
      a.slot.slotId.localeCompare(b.slot.slotId)
    )[0]?.slot;
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

  const spawnStrongestAffordableNow = (): boolean => {
    const emergency = [...state.playerSlots]
      .filter((slot) => slot.cost <= state.supply && getCooldownRemaining(state, slot.slotId) === 0)
      .sort((a, b) => b.cost - a.cost || a.slotId.localeCompare(b.slotId))[0];
    return emergency ? recordSpawn(emergency.slotId) : false;
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

  // Once the campaign has introduced supply upgrades as a real strategic choice, a competent
  // baseline may invest immediately if it can still retain enough supply for the cheapest defender.
  // This replaces the old fixed "deploy three units first" opening and does not grant extra resources.
  if (stageIndex >= OPENING_ECONOMY_STAGE_INDEX && state.supplyLevel < targetSupplyLevel) {
    const next = getNextSupplyLevel(state);
    const cheapestCost = Math.min(...state.playerSlots.map((slot) => slot.cost));
    if (next && state.supply >= next.upgradeCost + cheapestCost) {
      const upgraded = tryUpgradeSupply(state);
      if (upgraded.ok) upgradeCount += 1;
    }
  }

  for (let step = 0; step < maxTicks && state.battle.winner === null; step += 1) {
    advancePastCoolingSlots();
    const targetSlot = state.playerSlots[rosterCursor]!;
    const currentWallet = getCurrentSupplyLevel(state).maxSupply;
    const enemiesAtDecision = targetableEnemyCount(state);
    const alivePlayersAtDecision = alivePlayerUnitCount(state);

    // Actual pressure overrides planned saving. A human player would not keep hoarding for the next
    // roster slot, worker level or specialist while the final defender is disappearing under a wave.
    const emergencyPressure = enemiesAtDecision > 0 && alivePlayersAtDecision <= EMERGENCY_FRONTLINE_COUNT;
    const emergencySpawned = emergencyPressure && spawnStrongestAffordableNow();

    if (!emergencySpawned) {
      // After the opening choice, additional economy tiers still require real field presence first.
      // This keeps production and investment competing instead of turning the baseline into worker rush AI.
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
      } else {
        // Boss stages should test the roster the player actually owns, not a bot that spends every coin
        // on cheap rotation units. Once a stable front exists, reserve for a ready specialist whose
        // explicit damage bonus matches a living boss trait. Emergency defense above always wins over saving.
        const bossCounter = stageIndex >= BOSS_COUNTER_STAGE_INDEX && alivePlayersAtDecision >= STABLE_FRONTLINE_COUNT
          ? selectReadyBossCounter(state)
          : undefined;
        const counterFitsWallet = bossCounter !== undefined && bossCounter.cost <= currentWallet;

        if (bossCounter && counterFitsWallet) {
          if (state.supply >= bossCounter.cost) recordSpawn(bossCounter.slotId);
          // Otherwise intentionally save this tick instead of draining supply on the cheap roster cycle.
        } else if (state.supply >= targetSlot.cost && getCooldownRemaining(state, targetSlot.slotId) === 0) {
          if (recordSpawn(targetSlot.slotId)) rosterCursor = (rosterCursor + 1) % state.playerSlots.length;
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
