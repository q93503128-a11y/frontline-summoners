import { UnitState } from './index.ts';
import {
  computePlayableStateHash,
  createPlayableBattle,
  stepPlayableBattle,
  type EnemyWaveDefinition,
  type PlayableBattleConfig,
  type PlayableBattleState,
} from './playable.ts';

export const RECORD_TICKS_PER_MINUTE = 30 * 60;
export const DEFAULT_RECORD_ENEMY_BASE_HP = 2_000_000_000;

export interface EndlessRecordConfig extends Omit<PlayableBattleConfig, 'enemyBaseHp'> {
  readonly enemyBaseHp?: number;
}

export interface EndlessRecordState {
  readonly mode: 'ENDLESS_FRONT';
  readonly battle: PlayableBattleState;
  ended: boolean;
}

export interface BossRushEntry {
  readonly enemyId: string;
  readonly magnificationPermille: number;
  readonly restFramesAfterDefeat: number;
}

export interface BossRushRecordConfig extends Omit<PlayableBattleConfig, 'enemyBaseHp' | 'enemyWaves'> {
  readonly bossSequence: readonly BossRushEntry[];
  readonly enemyBaseHp?: number;
  readonly firstBossDelayFrames?: number;
}

export interface BossRushRecordState {
  readonly mode: 'BOSS_RUSH';
  readonly battle: PlayableBattleState;
  readonly bossSequence: readonly BossRushEntry[];
  readonly defeatedBossSimulationIds: Set<number>;
  defeatedBosses: number;
  ended: boolean;
  completed: boolean;
}

function keepRecordEnemyBaseAlive(battle: PlayableBattleState): void {
  if (battle.battle.winner !== 'PLAYER') return;
  battle.battle.bases.ENEMY.hp = battle.battle.bases.ENEMY.maxHp;
  battle.battle.winner = null;
  battle.stateHash = computePlayableStateHash(battle);
}

export function createEndlessRecordBattle(config: EndlessRecordConfig): EndlessRecordState {
  return {
    mode: 'ENDLESS_FRONT',
    battle: createPlayableBattle({
      ...config,
      enemyBaseHp: config.enemyBaseHp ?? DEFAULT_RECORD_ENEMY_BASE_HP,
    }),
    ended: false,
  };
}

export function stepEndlessRecordBattle(state: EndlessRecordState): EndlessRecordState {
  if (state.ended) return state;
  stepPlayableBattle(state.battle);
  keepRecordEnemyBaseAlive(state.battle);
  if (state.battle.battle.winner === 'ENEMY') state.ended = true;
  return state;
}

export function getEndlessRecordSurvivalTicks(state: EndlessRecordState): number {
  return state.battle.battle.tick;
}

export function getEndlessRecordSurvivalMs(state: EndlessRecordState): number {
  return Math.floor(getEndlessRecordSurvivalTicks(state) * 1000 / 30);
}

export function getEndlessRecordReachedMinute(state: EndlessRecordState): number {
  return Math.floor(getEndlessRecordSurvivalTicks(state) / RECORD_TICKS_PER_MINUTE);
}

export function buildBossRushWaves(
  bossSequence: readonly BossRushEntry[],
  firstBossDelayFrames = 90,
): readonly EnemyWaveDefinition[] {
  if (bossSequence.length === 0) throw new Error('boss rush requires at least one boss');
  return bossSequence.map((entry, index): EnemyWaveDefinition => {
    if (!Number.isInteger(entry.magnificationPermille) || entry.magnificationPermille < 100 || entry.magnificationPermille > 10000) {
      throw new Error(`boss rush magnification must be in 100..10000:${entry.enemyId}`);
    }
    if (!Number.isInteger(entry.restFramesAfterDefeat) || entry.restFramesAfterDefeat < 0) {
      throw new Error(`boss rush rest frames must be non-negative:${entry.enemyId}`);
    }
    return {
      id: `BOSS_${String(index + 1).padStart(2, '0')}`,
      trigger: index === 0
        ? { type: 'TIME', frame: firstBossDelayFrames }
        : { type: 'AFTER_WAVE_CLEARED', waveId: `BOSS_${String(index).padStart(2, '0')}`, delayFrames: bossSequence[index - 1]!.restFramesAfterDefeat },
      spawn: { enemyId: entry.enemyId, count: 1, intervalFrames: 1, magnificationPermille: entry.magnificationPermille },
    };
  });
}

export function createBossRushRecordBattle(config: BossRushRecordConfig): BossRushRecordState {
  const waves = buildBossRushWaves(config.bossSequence, config.firstBossDelayFrames ?? 90);
  return {
    mode: 'BOSS_RUSH',
    battle: createPlayableBattle({
      mapLength: config.mapLength,
      playerBaseHp: config.playerBaseHp,
      enemyBaseHp: config.enemyBaseHp ?? DEFAULT_RECORD_ENEMY_BASE_HP,
      ...(config.startingSupply === undefined ? {} : { startingSupply: config.startingSupply }),
      ...(config.playerUnitCap === undefined ? {} : { playerUnitCap: config.playerUnitCap }),
      ...(config.enemyUnitCap === undefined ? {} : { enemyUnitCap: config.enemyUnitCap }),
      ...(config.supplyLevels === undefined ? {} : { supplyLevels: config.supplyLevels }),
      ...(config.baseWeapon === undefined ? {} : { baseWeapon: config.baseWeapon }),
      playerSlots: config.playerSlots,
      enemies: config.enemies,
      enemyWaves: waves,
    }),
    bossSequence: config.bossSequence,
    defeatedBossSimulationIds: new Set<number>(),
    defeatedBosses: 0,
    ended: false,
    completed: false,
  };
}

function updateBossRushDefeats(state: BossRushRecordState): void {
  const expected = state.bossSequence[state.defeatedBosses];
  if (!expected) return;
  const defeated = state.battle.battle.units.find((unit) => (
    unit.team === 'ENEMY'
    && unit.definition.id === expected.enemyId
    && unit.state === UnitState.Dying
    && !state.defeatedBossSimulationIds.has(unit.simulationId)
  ));
  if (!defeated) return;
  state.defeatedBossSimulationIds.add(defeated.simulationId);
  state.defeatedBosses += 1;
  if (state.defeatedBosses >= state.bossSequence.length) {
    state.completed = true;
    state.ended = true;
  }
}

export function stepBossRushRecordBattle(state: BossRushRecordState): BossRushRecordState {
  if (state.ended) return state;
  stepPlayableBattle(state.battle);
  keepRecordEnemyBaseAlive(state.battle);
  updateBossRushDefeats(state);
  if (state.battle.battle.winner === 'ENEMY') state.ended = true;
  return state;
}
