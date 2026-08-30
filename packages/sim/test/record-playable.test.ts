import assert from 'node:assert/strict';
import test from 'node:test';
import type { BattleUnitDefinition } from '../src/index.ts';
import { trySpawnPlayerUnit, type EnemyArchetype, type PlayerRosterSlot } from '../src/playable.ts';
import {
  buildBossRushWaves,
  createBossRushRecordBattle,
  createEndlessRecordBattle,
  getEndlessRecordReachedMinute,
  stepBossRushRecordBattle,
  stepEndlessRecordBattle,
} from '../src/record-playable.ts';

function fighter(id: string, hp: number, attackDamage: number, moveSpeed = 5): BattleUnitDefinition {
  return {
    id,
    maxHp: hp,
    attackDamage,
    moveSpeed,
    standingRange: 30,
    attackMinRange: 0,
    attackMaxRange: 55,
    targetMode: 'SINGLE',
    attributes: ['NEUTRAL'],
    combatTags: [],
    damageBonuses: [],
    naturalKnockbackCount: 0,
    naturalKnockbackFrames: 1,
    naturalKnockbackDistance: 0,
    deathFrames: 1,
    attackTiming: { cycleFrames: 5, hitFrames: [1], backswingFrames: 1 },
  };
}

const playerSlot: PlayerRosterSlot = {
  slotId: 'record-test-player',
  displayName: '기록전 테스트 병력',
  definition: fighter('record-test-player', 10000, 5000, 12),
  cost: 0,
  rechargeFrames: 60,
};

const enemies: readonly EnemyArchetype[] = [
  { enemyId: 'record-test-enemy', displayName: '기록전 잡몹', definition: fighter('record-test-enemy', 100, 1, 0.1), rewardSupply: 0 },
  { enemyId: 'record-test-boss-a', displayName: '보스 A', definition: fighter('record-test-boss-a', 120, 1, 0.1), rewardSupply: 0 },
  { enemyId: 'record-test-boss-b', displayName: '보스 B', definition: fighter('record-test-boss-b', 140, 1, 0.1), rewardSupply: 0 },
];

test('endless record ignores enemy-base victory and only ends on player-base defeat', () => {
  const state = createEndlessRecordBattle({
    mapLength: 500,
    playerBaseHp: 10000,
    enemyBaseHp: 50,
    startingSupply: 0,
    playerSlots: [playerSlot],
    enemies,
    enemyWaves: [],
  });
  assert.equal(trySpawnPlayerUnit(state.battle, playerSlot.slotId).ok, true);
  for (let i = 0; i < 300 && state.battle.battle.bases.ENEMY.hp > 0; i += 1) stepEndlessRecordBattle(state);
  assert.equal(state.battle.battle.winner, null);
  assert.equal(state.ended, false);
  assert.equal(state.battle.battle.bases.ENEMY.hp, state.battle.battle.bases.ENEMY.maxHp);

  state.battle.battle.bases.PLAYER.hp = 0;
  state.battle.battle.winner = 'ENEMY';
  stepEndlessRecordBattle(state);
  assert.equal(state.ended, true);
});

test('endless minute score is derived only from deterministic simulation ticks', () => {
  const state = createEndlessRecordBattle({
    mapLength: 500,
    playerBaseHp: 10000,
    startingSupply: 0,
    playerSlots: [playerSlot],
    enemies,
    enemyWaves: [],
  });
  for (let i = 0; i < 1800; i += 1) stepEndlessRecordBattle(state);
  assert.equal(getEndlessRecordReachedMinute(state), 1);
});

test('boss rush wave builder preserves sequential clear gates and authored rest time', () => {
  const waves = buildBossRushWaves([
    { enemyId: 'record-test-boss-a', magnificationPermille: 650, restFramesAfterDefeat: 450 },
    { enemyId: 'record-test-boss-b', magnificationPermille: 700, restFramesAfterDefeat: 600 },
  ], 90);
  assert.deepEqual(waves[0]!.trigger, { type: 'TIME', frame: 90 });
  assert.deepEqual(waves[1]!.trigger, { type: 'AFTER_WAVE_CLEARED', waveId: 'BOSS_01', delayFrames: 450 });
});

test('boss rush counts each sequential boss once without resetting economy or cooldown state', () => {
  const state = createBossRushRecordBattle({
    mapLength: 500,
    playerBaseHp: 10000,
    startingSupply: 0,
    playerSlots: [playerSlot],
    enemies,
    bossSequence: [
      { enemyId: 'record-test-boss-a', magnificationPermille: 650, restFramesAfterDefeat: 5 },
      { enemyId: 'record-test-boss-b', magnificationPermille: 700, restFramesAfterDefeat: 5 },
    ],
    firstBossDelayFrames: 1,
  });
  assert.equal(trySpawnPlayerUnit(state.battle, playerSlot.slotId).ok, true);
  const readyTick = state.battle.cooldownReadyTick[playerSlot.slotId];
  for (let i = 0; i < 500 && !state.ended; i += 1) stepBossRushRecordBattle(state);
  assert.equal(state.defeatedBosses, 2);
  assert.equal(state.completed, true);
  assert.equal(state.ended, true);
  assert.equal(state.battle.cooldownReadyTick[playerSlot.slotId], readyTick);
});
