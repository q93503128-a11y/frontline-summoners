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
const OPENING_ECONOMY_STAGE_INDEX = 7;
const FINAL_CAMPAIGN_TACTICAL_STAGE_INDEX = 15;
const TACTICAL_PREP_COUNT = 3;
const TACTICAL_LEVEL_THREE_DEPLOYMENTS = 5;
const TACTICAL_MAX_SAVE_SECONDS = 12;
const TACTICAL_WAIT_PENALTY_SECONDS = 4;

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

function selectAffordableAnchor(state: ReturnType<typeof createPrototypeBattle>) {
  return [...state.playerSlots]
    .filter((slot) => slot.cost <= state.supply && getCooldownRemaining(state, slot.slotId) === 0)
    .sort((a, b) => {
      const aEfficiency = a.definition.maxHp / Math.max(1, a.cost);
      const bEfficiency = b.definition.maxHp / Math.max(1, b.cost);
      return bEfficiency - aEfficiency || b.definition.maxHp - a.definition.maxHp || a.cost - b.cost || a.slotId.localeCompare(b.slotId);
    })[0];
}

function selectCheapestAffordableReady(state: ReturnType<typeof createPrototypeBattle>) {
  return [...state.playerSlots]
    .filter((slot) => slot.cost <= state.supply && getCooldownRemaining(state, slot.slotId) === 0)
    .sort((a, b) => a.cost - b.cost || a.slotId.localeCompare(b.slotId))[0];
}

function selectTacticalCombatSlot(state: ReturnType<typeof createPrototypeBattle>, enemyCount: number) {
  const enemyTraits = new Set(
    state.battle.units
      .filter((unit) => unit.team === 'ENEMY' && unit.state !== 'DYING')
      .flatMap((unit) => unit.definition.traits ?? []),
  );
  const supplyLevel = getCurrentSupplyLevel(state);

  return [...state.playerSlots]
    .filter((slot) => slot.cost <= supplyLevel.maxSupply && getCooldownRemaining(state, slot.slotId) === 0)
    .map((slot) => {
      const missingSupply = Math.max(0, slot.cost - state.supply);
      const waitSeconds = missingSupply / Math.max(1, supplyLevel.incomePerSecond);
      if (waitSeconds > TACTICAL_MAX_SAVE_SECONDS) return null;

      const multiplierPermille = (slot.definition.damageBonuses ?? [])
        .filter((bonus) => enemyTraits.has(bonus.trait))
        .reduce((best, bonus) => Math.max(best, bonus.multiplierPermille), 1000);
      const cycleFrames = slot.definition.attackTiming.cycleFrames;
      const dpsPerFrame = (slot.definition.attackDamage * multiplierPermille) / 1000 / cycleFrames;
      const areaFactor = slot.definition.targetMode === 'AREA'
        ? Math.min(2.6, 1 + 0.25 * Math.max(0, enemyCount - 1))
        : 1;
      const rangeFactor = 1 + Math.min(slot.definition.standingRange, 250) / 800;
      const durabilityValue = slot.definition.maxHp / 1200;
      const rawScore = dpsPerFrame * areaFactor * rangeFactor + durabilityValue;
      const score = rawScore / (1 + waitSeconds / TACTICAL_WAIT_PENALTY_SECONDS);
      return { slot, score, rawScore, waitSeconds };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((a, b) =>
      b.score - a.score ||
      b.rawScore - a.rawScore ||
      a.waitSeconds - b.waitSeconds ||
      a.slot.cost - b.slot.cost ||
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
  const tacticalFinalStage = stageIndex >= FINAL_CAMPAIGN_TACTICAL_STAGE_INDEX;

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

    if (tacticalFinalStage) {
      let acted = false;

      // When the field is completely empty under pressure, rebuild one efficient anchor immediately.
      // Do not let a planned worker level or high-cost damage dealer turn a recoverable position into a loss.
      if (enemiesAtDecision > 0 && alivePlayersAtDecision === 0) {
        const anchor = selectAffordableAnchor(state);
        acted = anchor ? recordSpawn(anchor.slotId) : false;
      }

      if (!acted) {
        // The late-campaign baseline needs five real deployments before Lv3 investment. This is slightly
        // faster than the generic 3-per-level rule because the opening Lv2 investment already happened.
        const deploymentUnlockedEconomyLevel = spawnCount >= TACTICAL_LEVEL_THREE_DEPLOYMENTS
          ? 3
          : 1 + Math.floor(spawnCount / DEPLOYMENTS_PER_ECONOMY_LEVEL);
        const plannedEconomyLevel = Math.min(targetSupplyLevel, deploymentUnlockedEconomyLevel);
        if (state.supplyLevel < plannedEconomyLevel) {
          acted = true;
          const next = getNextSupplyLevel(state);
          if (next && state.supply >= next.upgradeCost) {
            const upgraded = tryUpgradeSupply(state);
            if (upgraded.ok) upgradeCount += 1;
          }
        }
      }

      if (!acted) {
        if (enemiesAtDecision === 0) {
          // Establish a small screen before first contact, then bank rather than filling the field with cheap units.
          if (alivePlayersAtDecision < TACTICAL_PREP_COUNT) {
            const prep = selectCheapestAffordableReady(state);
            if (prep) recordSpawn(prep.slotId);
          }
        } else {
          // Under pressure, choose from the roster the player actually owns using current enemy traits,
          // area value, range, durability and the real time required to save the missing supply.
          const tacticalSlot = selectTacticalCombatSlot(state, enemiesAtDecision);
          if (tacticalSlot) {
            if (state.supply >= tacticalSlot.cost) recordSpawn(tacticalSlot.slotId);
            // Otherwise intentionally save for at most TACTICAL_MAX_SAVE_SECONDS. If the line fully breaks,
            // the anchor rule above takes over immediately on the next decision tick.
          } else {
            spawnStrongestAffordableNow();
          }
        }
      }
    } else {
      // Early and mid campaign keep the deliberately simple roster-cycle baseline. This prevents a final-stage
      // tuning change from silently rewriting the already-established first fifteen stages.
      const emergencyPressure = enemiesAtDecision > 0 && alivePlayersAtDecision <= EMERGENCY_FRONTLINE_COUNT;
      const emergencySpawned = emergencyPressure && spawnStrongestAffordableNow();

      if (!emergencySpawned) {
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
