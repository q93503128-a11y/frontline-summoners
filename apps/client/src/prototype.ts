import type { BattleUnitDefinition } from '@frontline/sim';
import { createPlayableBattle, type PlayableBattleState, type PlayerRosterSlot, type EnemyArchetype, type EnemyWaveDefinition } from '@frontline/sim/playable';

const fighter = (
  id: string,
  maxHp: number,
  attackDamage: number,
  moveSpeed: number,
  standingRange: number,
  attackMinRange: number,
  attackMaxRange: number,
  cycleFrames: number,
  hitFrames: readonly number[],
  backswingFrames: number,
  naturalKnockbackCount: number,
  targetMode: 'SINGLE' | 'AREA' = 'SINGLE',
): BattleUnitDefinition => ({
  id,
  maxHp,
  attackDamage,
  moveSpeed,
  standingRange,
  attackMinRange,
  attackMaxRange,
  targetMode,
  naturalKnockbackCount,
  naturalKnockbackFrames: 12,
  naturalKnockbackDistance: 34,
  deathFrames: 12,
  attackTiming: { cycleFrames, hitFrames, backswingFrames },
});

export const PLAYER_SLOTS: readonly PlayerRosterSlot[] = [
  {
    slotId: 'militia',
    displayName: '민병대',
    definition: fighter('militia', 135, 14, 5, 42, 0, 50, 24, [5], 5, 2),
    cost: 50,
    rechargeFrames: 42,
  },
  {
    slotId: 'swordsman',
    displayName: '검사',
    definition: fighter('swordsman', 390, 58, 4, 52, 0, 62, 42, [9], 8, 3),
    cost: 180,
    rechargeFrames: 90,
  },
  {
    slotId: 'archer',
    displayName: '궁수',
    definition: fighter('archer', 205, 52, 3, 172, 85, 205, 54, [13], 9, 3),
    cost: 300,
    rechargeFrames: 120,
  },
  {
    slotId: 'mage',
    displayName: '불꽃술사',
    definition: fighter('mage', 270, 88, 2, 205, 55, 235, 72, [20], 12, 2, 'AREA'),
    cost: 520,
    rechargeFrames: 165,
  },
  {
    slotId: 'hammer',
    displayName: '망치광',
    definition: fighter('hammer', 980, 280, 2, 64, 0, 82, 102, [38], 18, 1, 'AREA'),
    cost: 1200,
    rechargeFrames: 300,
  },
] as const;

export const ENEMIES: readonly EnemyArchetype[] = [
  {
    enemyId: 'crumb-slime',
    displayName: '빵부스러기 슬라임',
    definition: fighter('crumb-slime', 105, 12, 3, 38, 0, 45, 34, [8], 6, 1),
    rewardSupply: 30,
  },
  {
    enemyId: 'boar',
    displayName: '성난 멧돼지',
    definition: fighter('boar', 360, 48, 5, 44, 0, 55, 46, [10], 8, 2),
    rewardSupply: 85,
  },
  {
    enemyId: 'pot-guard',
    displayName: '냄비 근위병',
    definition: fighter('pot-guard', 760, 72, 2, 48, 0, 58, 62, [16], 12, 4),
    rewardSupply: 155,
  },
  {
    enemyId: 'boar-chief',
    displayName: '황금국자 멧돼지 대장',
    definition: fighter('boar-chief', 2800, 190, 2, 78, 0, 105, 94, [30], 18, 4, 'AREA'),
    rewardSupply: 650,
  },
] as const;

export const WAVES: readonly EnemyWaveDefinition[] = [
  { enemyId: 'crumb-slime', atTick: 90, count: 5, intervalTicks: 105 },
  { enemyId: 'boar', atTick: 360, count: 4, intervalTicks: 150 },
  { enemyId: 'pot-guard', atTick: 690, count: 3, intervalTicks: 210 },
  { enemyId: 'crumb-slime', atTick: 930, count: 6, intervalTicks: 80 },
  { enemyId: 'boar-chief', atTick: 1260, count: 1, intervalTicks: 9999 },
] as const;

export const PROTOTYPE_MAP_LENGTH = 1000;

export function createPrototypeBattle(): PlayableBattleState {
  return createPlayableBattle({
    mapLength: PROTOTYPE_MAP_LENGTH,
    playerBaseHp: 3200,
    enemyBaseHp: 3600,
    startingSupply: 300,
    playerSlots: PLAYER_SLOTS,
    enemies: ENEMIES,
    enemyWaves: WAVES,
    playerUnitCap: 50,
    enemyUnitCap: 50,
  });
}

export const UNIT_DISPLAY_NAMES: Readonly<Record<string, string>> = Object.fromEntries([
  ...PLAYER_SLOTS.map((slot) => [slot.definition.id, slot.displayName]),
  ...ENEMIES.map((enemy) => [enemy.definition.id, enemy.displayName]),
]);
