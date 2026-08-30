import {
  createBossRushRecordBattle,
  createEndlessRecordBattle,
  type BossRushEntry,
  type BossRushRecordState,
  type EndlessRecordState,
} from '@frontline/sim/record-playable';
import { getBaseWeaponDefinition, type EnemyWaveDefinition } from '@frontline/sim/playable';
import { buildGuestDeckSlots } from './player-loadout.ts';
import { applyPermanentRewardBattleEffects } from './permanent-rewards.ts';
import { ENEMIES, getContiguousClearedStageIds } from './prototype.ts';
import { getGuestSelectedBaseWeaponId, normalizeGuestProgress, type GuestProgress } from './save.ts';

export const RECORD_MODE_IDS = ['record_endless_front', 'record_boss_rush'] as const;
export type RecordModeId = (typeof RECORD_MODE_IDS)[number];

export interface RecordModeDefinition {
  readonly id: RecordModeId;
  readonly displayName: string;
  readonly description: string;
  readonly unlockAfterStageId: string;
  readonly speedMultiplier: 1;
  readonly sweepAllowed: false;
  readonly multiplayerPolicy: 'SOLO_ONLY';
}

export const RECORD_MODE_DEFINITIONS: readonly RecordModeDefinition[] = [
  {
    id: 'record_endless_front',
    displayName: '끝없는 전선',
    description: '점점 강해지는 결정론적 전선을 버티며 최고 생존 시간을 갱신한다.',
    unlockAfterStageId: 'main_03_020',
    speedMultiplier: 1,
    sweepAllowed: false,
    multiplayerPolicy: 'SOLO_ONLY',
  },
  {
    id: 'record_boss_rush',
    displayName: '보스 러시',
    description: '보급과 쿨타임을 유지한 채 메인·SPECIAL 보스를 순서대로 격파한다.',
    unlockAfterStageId: 'main_04_020',
    speedMultiplier: 1,
    sweepAllowed: false,
    multiplayerPolicy: 'SOLO_ONLY',
  },
] as const;

const ENDLESS_WAVES: readonly EnemyWaveDefinition[] = [
  { id: 'E00_RAIDER', trigger: { type: 'TIME', frame: 300 }, spawn: { enemyId: 'enemy-raider', count: 3, intervalFrames: 75, magnificationPermille: 800 }, repeat: { delayFrames: 480, maxCycles: 5 } },
  { id: 'E01_SPRINTER', trigger: { type: 'TIME', frame: 900 }, spawn: { enemyId: 'enemy-sprinter', count: 4, intervalFrames: 60, magnificationPermille: 850 }, repeat: { delayFrames: 600, maxCycles: 5 } },
  { id: 'E02_MOSS', trigger: { type: 'TIME', frame: 3600 }, spawn: { enemyId: 'enemy_ch2_mossboar', count: 1, intervalFrames: 1, magnificationPermille: 1000 }, repeat: { delayFrames: 750, maxCycles: 5 } },
  { id: 'E03_BONE', trigger: { type: 'TIME', frame: 3900 }, spawn: { enemyId: 'enemy_ch2_bonewheel', count: 5, intervalFrames: 55, magnificationPermille: 1050 }, repeat: { delayFrames: 630, maxCycles: 6 } },
  { id: 'E03_ROOTWIDOW', trigger: { type: 'TIME', frame: 5400 }, spawn: { enemyId: 'boss_ch2_rootwidow', count: 1, intervalFrames: 1, magnificationPermille: 550 } },
  { id: 'E04_ARCANE', trigger: { type: 'TIME', frame: 7200 }, spawn: { enemyId: 'enemy_ch3_glasseye', count: 3, intervalFrames: 100, magnificationPermille: 1150 }, repeat: { delayFrames: 660, maxCycles: 5 } },
  { id: 'E04_RUSH', trigger: { type: 'TIME', frame: 7500 }, spawn: { enemyId: 'enemy_ch3_spellbug', count: 6, intervalFrames: 48, magnificationPermille: 1200 }, repeat: { delayFrames: 720, maxCycles: 5 } },
  { id: 'E05_ARCHMAGUS', trigger: { type: 'TIME', frame: 9000 }, spawn: { enemyId: 'boss_ch3_archmagus', count: 1, intervalFrames: 1, magnificationPermille: 550 } },
  { id: 'E06_MACHINE', trigger: { type: 'TIME', frame: 10800 }, spawn: { enemyId: 'enemy_ch4_sawbird', count: 5, intervalFrames: 55, magnificationPermille: 1350 }, repeat: { delayFrames: 600, maxCycles: 6 } },
  { id: 'E06_ANOMALY', trigger: { type: 'TIME', frame: 11100 }, spawn: { enemyId: 'enemy_ch4_error_mass', count: 2, intervalFrames: 140, magnificationPermille: 1400 }, repeat: { delayFrames: 780, maxCycles: 5 } },
  { id: 'E07_THRONE', trigger: { type: 'TIME', frame: 12600 }, spawn: { enemyId: 'boss_ch4_moving_throne', count: 1, intervalFrames: 1, magnificationPermille: 550 } },
  { id: 'E08_ELITE_FRONT', trigger: { type: 'TIME', frame: 14400 }, spawn: { enemyId: 'enemy_ch4_fusion_cavalry', count: 1, intervalFrames: 1, magnificationPermille: 1500 }, repeat: { delayFrames: 600 } },
  { id: 'E08_ELITE_REAR', trigger: { type: 'TIME', frame: 14700 }, spawn: { enemyId: 'enemy_ch3_floating_library', count: 1, intervalFrames: 1, magnificationPermille: 1550 }, repeat: { delayFrames: 900 } },
  { id: 'E09_BELZAR', trigger: { type: 'TIME', frame: 16200 }, spawn: { enemyId: 'boss_ch3_belzar', count: 1, intervalFrames: 1, magnificationPermille: 650 } },
  { id: 'E10_PRESSURE', trigger: { type: 'TIME', frame: 18000 }, spawn: { enemyId: 'enemy_ch4_error_mass', count: 3, intervalFrames: 110, magnificationPermille: 1700 }, repeat: { delayFrames: 510 } },
  { id: 'E10_RANGE', trigger: { type: 'TIME', frame: 18300 }, spawn: { enemyId: 'enemy_ch4_void_lens', count: 1, intervalFrames: 1, magnificationPermille: 1650 }, repeat: { delayFrames: 750 } },
  { id: 'E11_ZERO', trigger: { type: 'TIME', frame: 19800 }, spawn: { enemyId: 'boss_ch4_zero_engine', count: 1, intervalFrames: 1, magnificationPermille: 650 } },
  { id: 'E13_GLUTTON', trigger: { type: 'TIME', frame: 23400 }, spawn: { enemyId: 'boss_sp_glutton_drake', count: 1, intervalFrames: 1, magnificationPermille: 800 } },
  { id: 'E15_ANOMALY_BOSS', trigger: { type: 'TIME', frame: 27000 }, spawn: { enemyId: 'boss_sp_unobservable', count: 1, intervalFrames: 1, magnificationPermille: 900 } },
];

export const BOSS_RUSH_SEQUENCE: readonly BossRushEntry[] = [
  { enemyId: 'enemy-boss', magnificationPermille: 650, restFramesAfterDefeat: 600 },
  { enemyId: 'enemy-boss-iron', magnificationPermille: 650, restFramesAfterDefeat: 600 },
  { enemyId: 'boss_ch2_rootwidow', magnificationPermille: 700, restFramesAfterDefeat: 600 },
  { enemyId: 'boss_ch2_funeral_king', magnificationPermille: 700, restFramesAfterDefeat: 600 },
  { enemyId: 'boss_ch3_archmagus', magnificationPermille: 750, restFramesAfterDefeat: 600 },
  { enemyId: 'boss_ch3_belzar', magnificationPermille: 750, restFramesAfterDefeat: 600 },
  { enemyId: 'boss_ch4_moving_throne', magnificationPermille: 800, restFramesAfterDefeat: 600 },
  { enemyId: 'boss_ch4_zero_engine', magnificationPermille: 800, restFramesAfterDefeat: 600 },
  { enemyId: 'boss_sp_glutton_drake', magnificationPermille: 900, restFramesAfterDefeat: 600 },
] as const;

for (const wave of ENDLESS_WAVES) {
  if (!ENEMIES.some((enemy) => enemy.enemyId === wave.spawn.enemyId)) throw new Error(`endless record references unknown enemy:${wave.spawn.enemyId}`);
}
for (const entry of BOSS_RUSH_SEQUENCE) {
  if (!ENEMIES.some((enemy) => enemy.enemyId === entry.enemyId)) throw new Error(`boss rush references unknown enemy:${entry.enemyId}`);
}

export function getRecordModeDefinition(modeId: RecordModeId): RecordModeDefinition {
  const mode = RECORD_MODE_DEFINITIONS.find((candidate) => candidate.id === modeId);
  if (!mode) throw new Error(`Unknown record mode:${modeId}`);
  return mode;
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
    enemyWaves: ENDLESS_WAVES,
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
