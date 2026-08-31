import {
  BOSS_RUSH_SEQUENCE,
  ENDLESS_RECORD_WAVES,
  RECORD_MODE_DEFINITIONS,
  RECORD_MODE_IDS,
  getRecordModeDefinition,
  type RecordModeDefinition,
  type RecordModeId,
} from '@frontline/sim/record-content';
import {
  createBossRushRecordBattle,
  createEndlessRecordBattle,
  type BossRushRecordState,
  type EndlessRecordState,
} from '@frontline/sim/record-playable';
import { getBaseWeaponDefinition } from '@frontline/sim/playable';
import { buildGuestDeckSlots } from './player-loadout.ts';
import { applyPermanentRewardBattleEffects } from './permanent-rewards.ts';
import { ENEMIES, getContiguousClearedStageIds } from './prototype.ts';
import { getGuestSelectedBaseWeaponId, normalizeGuestProgress, type GuestProgress } from './save.ts';

export {
  BOSS_RUSH_SEQUENCE,
  ENDLESS_RECORD_WAVES,
  RECORD_MODE_DEFINITIONS,
  RECORD_MODE_IDS,
  getRecordModeDefinition,
  type RecordModeDefinition,
  type RecordModeId,
};

for (const wave of ENDLESS_RECORD_WAVES) {
  if (!ENEMIES.some((enemy) => enemy.enemyId === wave.spawn.enemyId)) throw new Error(`endless record references unknown enemy:${wave.spawn.enemyId}`);
}
for (const entry of BOSS_RUSH_SEQUENCE) {
  if (!ENEMIES.some((enemy) => enemy.enemyId === entry.enemyId)) throw new Error(`boss rush references unknown enemy:${entry.enemyId}`);
}

export function isRecordModeUnlocked(modeId: RecordModeId, clearedStageIds: readonly string[]): boolean {
  const mode = getRecordModeDefinition(modeId);
  return getContiguousClearedStageIds(clearedStageIds).includes(mode.unlockAfterStageId);
}

function recordProgressionInput(progress: GuestProgress, playerBaseHp: number, startingSupply: number) {
  const normalized = normalizeGuestProgress(progress);
  return applyPermanentRewardBattleEffects({
    ownedRewardIds: normalized.permanentRewardIds,
    startingSupply,
    playerBaseHp,
    playerUnitCap: 50,
    playerSlots: buildGuestDeckSlots(normalized),
    enemies: ENEMIES,
  });
}

export function createGuestEndlessRecordBattle(progress: GuestProgress): EndlessRecordState {
  const normalized = normalizeGuestProgress(progress);
  if (!isRecordModeUnlocked('record_endless_front', normalized.clearedStageIds)) throw new Error('record_mode_locked:record_endless_front');
  const progression = recordProgressionInput(normalized, 8000, 300);
  return createEndlessRecordBattle({
    mapLength: 2600,
    playerBaseHp: progression.playerBaseHp,
    startingSupply: progression.startingSupply,
    playerSlots: progression.playerSlots,
    enemies: progression.enemies,
    enemyWaves: ENDLESS_RECORD_WAVES,
    playerUnitCap: progression.playerUnitCap,
    enemyUnitCap: 42,
    supplyLevels: progression.supplyLevels,
    baseWeapon: getBaseWeaponDefinition(getGuestSelectedBaseWeaponId(normalized)),
  });
}

export function createGuestBossRushRecordBattle(progress: GuestProgress): BossRushRecordState {
  const normalized = normalizeGuestProgress(progress);
  if (!isRecordModeUnlocked('record_boss_rush', normalized.clearedStageIds)) throw new Error('record_mode_locked:record_boss_rush');
  const progression = recordProgressionInput(normalized, 9000, 350);
  return createBossRushRecordBattle({
    mapLength: 2850,
    playerBaseHp: progression.playerBaseHp,
    startingSupply: progression.startingSupply,
    playerSlots: progression.playerSlots,
    enemies: progression.enemies,
    bossSequence: BOSS_RUSH_SEQUENCE,
    firstBossDelayFrames: 90,
    playerUnitCap: progression.playerUnitCap,
    enemyUnitCap: 24,
    supplyLevels: progression.supplyLevels,
    baseWeapon: getBaseWeaponDefinition(getGuestSelectedBaseWeaponId(normalized)),
  });
}
