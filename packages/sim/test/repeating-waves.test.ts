import assert from 'node:assert/strict';
import test from 'node:test';
import { UnitState, type BattleUnitDefinition } from '../src/index.ts';
import {
  createPlayableBattle,
  stepPlayableBattle,
  type EnemyWaveDefinition,
  type PlayableBattleConfig,
} from '../src/playable.ts';

const unit = (id: string): BattleUnitDefinition => ({
  id,
  maxHp: 100000,
  attackDamage: 0,
  moveSpeed: 0,
  standingRange: 0,
  attackMinRange: 0,
  attackMaxRange: 0,
  targetMode: 'SINGLE',
  naturalKnockbackCount: 0,
  naturalKnockbackFrames: 12,
  naturalKnockbackDistance: 20,
  deathFrames: 1,
  attackTiming: { cycleFrames: 30, hitFrames: [5], backswingFrames: 6 },
  attributes: ['NEUTRAL'],
  combatTags: [],
  damageBonuses: [],
});

const wave = (
  count: number,
  intervalFrames: number,
  repeat?: EnemyWaveDefinition['repeat'],
): EnemyWaveDefinition => ({
  id: 'W1',
  trigger: { type: 'TIME', frame: 0 },
  spawn: { enemyId: 'grunt', count, intervalFrames, magnificationPermille: 1000 },
  ...(repeat === undefined ? {} : { repeat }),
});

const config = (enemyWaves: PlayableBattleConfig['enemyWaves'], enemyUnitCap = 50): PlayableBattleConfig => ({
  mapLength: 1000,
  playerBaseHp: 1000000,
  enemyBaseHp: 1000000,
  startingSupply: 0,
  playerSlots: [{ slotId: 'dummy', displayName: 'dummy', definition: unit('dummy'), cost: 0, rechargeFrames: 60 }],
  enemies: [{ enemyId: 'grunt', displayName: 'grunt', definition: unit('grunt'), rewardSupply: 0 }],
  enemyWaves,
  enemyUnitCap,
});

const step = (state: ReturnType<typeof createPlayableBattle>, ticks: number): void => {
  for (let index = 0; index < ticks; index += 1) stepPlayableBattle(state);
};

const enemySpawnCount = (state: ReturnType<typeof createPlayableBattle>): number => state.battle.nextSimulationId - 1;

test('one-shot wave still stops after one cycle', () => {
  const state = createPlayableBattle(config([wave(2, 2)]));
  step(state, 20);
  assert.equal(enemySpawnCount(state), 2);
});

test('finite repeating wave executes the requested number of cycles and then stops', () => {
  const state = createPlayableBattle(config([wave(2, 2, { delayFrames: 3, maxCycles: 2 })]));
  step(state, 30);
  assert.equal(enemySpawnCount(state), 4);
});

test('repeating wave without maxCycles continues until battle end', () => {
  const state = createPlayableBattle(config([wave(2, 2, { delayFrames: 3 })]));
  step(state, 20);
  assert.equal(enemySpawnCount(state), 8);
  assert.equal(state.battle.winner, null);
});

test('enemy cap defers a scheduled spawn and resumes spacing from the actual spawn tick', () => {
  const state = createPlayableBattle(config([wave(3, 10)], 1));

  step(state, 100);
  assert.equal(enemySpawnCount(state), 1);
  const first = state.battle.units.find((candidate) => candidate.team === 'ENEMY');
  assert.ok(first);
  first.state = UnitState.Dying;
  first.stateFrame = first.definition.deathFrames;

  stepPlayableBattle(state);
  assert.equal(enemySpawnCount(state), 2);
  const second = state.battle.units.find((candidate) => candidate.team === 'ENEMY' && candidate.state !== UnitState.Dying);
  assert.ok(second);
  second.state = UnitState.Dying;
  second.stateFrame = second.definition.deathFrames;

  step(state, 9);
  assert.equal(enemySpawnCount(state), 2, 'stalled waves must not catch up one spawn per tick');
  stepPlayableBattle(state);
  assert.equal(enemySpawnCount(state), 3);
});

test('repeat configuration is validated and participates in playable state hash', () => {
  const malformedRepeat = { maxCycles: 2 } as unknown as NonNullable<EnemyWaveDefinition['repeat']>;
  assert.throws(
    () => createPlayableBattle(config([wave(1, 1, malformedRepeat)])),
    /W1\.repeat\.delayFrames must be a positive integer/,
  );

  const oneShot = createPlayableBattle(config([wave(1, 1)]));
  const repeating = createPlayableBattle(config([wave(1, 1, { delayFrames: 10 })]));
  const finite = createPlayableBattle(config([wave(1, 1, { delayFrames: 10, maxCycles: 2 })]));

  assert.notEqual(oneShot.stateHash, repeating.stateHash);
  assert.notEqual(repeating.stateHash, finite.stateHash);
});
