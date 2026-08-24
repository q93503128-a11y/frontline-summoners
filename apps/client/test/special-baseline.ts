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
  PLAYER_SLOTS,
  SPECIAL_STAGES,
  STAGES,
  createPrototypeBattle,
  getTreasureIdsForClearedStages,
} from '../src/prototype.ts';

type SpecialBattle = ReturnType<typeof createPrototypeBattle>;

export interface SpecialBaselineResult {
  readonly stageId: string;
  readonly state: SpecialBattle;
  readonly seenEnemyIds: ReadonlySet<string>;
  readonly seenPlayerIds: ReadonlySet<string>;
  readonly spawnCount: number;
  readonly upgradeCount: number;
  readonly cannonCount: number;
  readonly maxAlivePlayerUnits: number;
}

const FULL_CHAPTER_CLEARS = STAGES.map((stage) => stage.id);
const FULL_CHAPTER_TREASURES = getTreasureIdsForClearedStages(FULL_CHAPTER_CLEARS);
const FULL_ROSTER = PLAYER_SLOTS.map((slot) => slot.slotId);
const TARGET_SUPPLY_LEVEL = 4;

function alivePlayerUnits(state: SpecialBattle) {
  return state.battle.units.filter((unit) => unit.team === 'PLAYER' && unit.state !== 'DYING');
}

function targetableEnemies(state: SpecialBattle) {
  return state.battle.units.filter((unit) =>
    unit.team === 'ENEMY' && unit.state !== 'DYING' && unit.state !== 'NATURAL_KNOCKBACK'
  );
}

function slotById(state: SpecialBattle, slotId: string) {
  return state.playerSlots.find((slot) => slot.slotId === slotId);
}

function readyAndAffordable(state: SpecialBattle, slotId: string): boolean {
  const slot = slotById(state, slotId);
  return !!slot && slot.cost <= state.supply && getCooldownRemaining(state, slot.slotId) === 0;
}

function strongestMatchingSlot(state: SpecialBattle, enemyCount: number) {
  const enemyTraits = new Set(targetableEnemies(state).flatMap((unit) => unit.definition.traits ?? []));
  const supplyLevel = getCurrentSupplyLevel(state);
  return [...state.playerSlots]
    .filter((slot) => slot.cost <= supplyLevel.maxSupply && getCooldownRemaining(state, slot.slotId) === 0)
    .map((slot) => {
      const multiplier = (slot.definition.damageBonuses ?? [])
        .filter((bonus) => enemyTraits.has(bonus.trait))
        .reduce((best, bonus) => Math.max(best, bonus.multiplierPermille), 1000);
      const dps = (slot.definition.attackDamage * multiplier * 30) /
        (1000 * Math.max(1, slot.definition.attackTiming.cycleFrames));
      const area = slot.definition.targetMode === 'AREA' ? Math.min(2.5, 1 + Math.max(0, enemyCount - 1) * 0.22) : 1;
      const durability = slot.definition.maxHp / 800;
      const range = 1 + Math.min(330, slot.definition.standingRange) / 900;
      const missing = Math.max(0, slot.cost - state.supply);
      const wait = missing / Math.max(1, supplyLevel.incomePerSecond);
      const bossBonus = enemyTraits.has('BOSS') && slot.slotId === 'voidsage' ? 2.2 : 1;
      const score = ((dps * area * range * bossBonus) + durability) / (1 + wait / 8);
      return { slot, score, wait };
    })
    .filter((candidate) => candidate.wait <= 16)
    .sort((a, b) => b.score - a.score || a.wait - b.wait || a.slot.cost - b.slot.cost)[0]?.slot;
}

/**
 * Deterministic competent-account baseline for the first SPECIAL pack.
 * It is intentionally separate from the chapter-one teaching baseline: these challenges open only
 * after ST20, so the account owns all ten core units and all twenty guaranteed chapter treasures.
 */
export function autoPlaySpecialStage(stageIndex: number, maxSeconds = 720): SpecialBaselineResult {
  const stage = SPECIAL_STAGES[stageIndex];
  if (!stage) throw new Error(`Unknown special stage index: ${stageIndex}`);
  const state = createPrototypeBattle(stage.id, FULL_ROSTER, FULL_CHAPTER_TREASURES);
  const seenEnemyIds = new Set<string>();
  const seenPlayerIds = new Set<string>();
  let spawnCount = 0;
  let upgradeCount = 0;
  let cannonCount = 0;
  let maxAlivePlayerUnits = 0;

  const spawn = (slotId: string): boolean => {
    const result = trySpawnPlayerUnit(state, slotId);
    if (!result.ok) return false;
    spawnCount += 1;
    return true;
  };

  // Open with one reliable anchor, then raise the wallet to Lv4 so the post-ST20 roster — including
  // 공허현자 — is genuinely usable. Every upgrade still pays the live in-battle cost.
  const lv2 = getNextSupplyLevel(state);
  if (lv2 && state.supply >= lv2.upgradeCost + 150) {
    if (tryUpgradeSupply(state).ok) upgradeCount += 1;
  }
  if (readyAndAffordable(state, 'guard')) spawn('guard');

  const maxTicks = maxSeconds * 30;
  for (let tick = 0; tick < maxTicks && state.battle.winner === null; tick += 1) {
    const enemies = targetableEnemies(state);
    const players = alivePlayerUnits(state);
    maxAlivePlayerUnits = Math.max(maxAlivePlayerUnits, players.length);

    // Complete the wallet investment as soon as one anchor is on the field. Low-cap challenges must
    // not fill their three real slots with disposable units before the expensive counter roster is available.
    if (state.supplyLevel < TARGET_SUPPLY_LEVEL && players.length >= 1) {
      const next = getNextSupplyLevel(state);
      if (next && state.supply >= next.upgradeCost) {
        if (tryUpgradeSupply(state).ok) upgradeCount += 1;
      }
    }

    const hasCapacity = players.length < state.playerUnitCap;
    if (hasCapacity) {
      let acted = false;
      const hasBoss = enemies.some((unit) => (unit.definition.traits ?? []).includes('BOSS'));

      if (hasBoss && readyAndAffordable(state, 'voidsage')) {
        acted = spawn('voidsage');
      }

      // A completely broken front is repaired immediately instead of waiting for an ideal damage dealer.
      if (!acted && enemies.length > 0 && players.length === 0) {
        for (const anchorId of ['royal', 'guard', 'duelist']) {
          if (readyAndAffordable(state, anchorId)) {
            acted = spawn(anchorId);
            break;
          }
        }
      }

      if (!acted && enemies.length > 0) {
        const tactical = strongestMatchingSlot(state, enemies.length);
        if (tactical && tactical.cost <= state.supply) acted = spawn(tactical.slotId);
      }

      // Before contact, build only a small prepared screen and preserve room for counters in cap-3 stages.
      if (!acted && enemies.length === 0) {
        const prepTarget = state.playerUnitCap <= 3 ? 2 : Math.min(4, state.playerUnitCap);
        if (players.length < prepTarget) {
          for (const prepId of ['royal', 'pyromancer', 'battlemage', 'guard']) {
            if (readyAndAffordable(state, prepId)) {
              acted = spawn(prepId);
              break;
            }
          }
        }
      }
    }

    const baseRatio = state.battle.bases.PLAYER.hp / state.battle.bases.PLAYER.maxHp;
    if (
      getBaseWeaponCooldownRemaining(state) === 0 &&
      (enemies.length >= 4 || (enemies.length >= 1 && baseRatio < 0.7))
    ) {
      if (tryFireBaseWeapon(state).ok) cannonCount += 1;
    }

    stepPlayableBattle(state);
    for (const unit of state.battle.units) {
      if (unit.team === 'ENEMY') seenEnemyIds.add(unit.definition.id);
      if (unit.team === 'PLAYER') seenPlayerIds.add(unit.definition.id);
    }
  }

  return {
    stageId: stage.id,
    state,
    seenEnemyIds,
    seenPlayerIds,
    spawnCount,
    upgradeCount,
    cannonCount,
    maxAlivePlayerUnits,
  };
}
