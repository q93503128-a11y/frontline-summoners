import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCampaignStages } from '../src/index.ts';

const stage = (wave: Record<string, unknown>) => ({
  id: 'test-stage',
  chapter: 'test',
  name: 'test',
  subtitle: 'test',
  difficulty: 1,
  playerBaseHp: 1000,
  enemyBaseHp: 1000,
  startingSupply: 50,
  mapLength: 800,
  theme: 'meadow',
  decorSeed: 1,
  waves: [wave],
  permanentRewardId: 'test-reward',
});

const options = { enemyIds: new Set(['enemy']) };

const wave = (repeat?: Record<string, unknown>) => ({
  id: 'W1',
  trigger: { type: 'TIME', frame: 30 },
  spawn: { enemyId: 'enemy', count: 4, intervalFrames: 20 },
  ...(repeat === undefined ? {} : { repeat }),
});

test('campaign wave parser preserves optional repeat-cycle controls', () => {
  const parsed = parseCampaignStages([stage(wave({ delayFrames: 180, maxCycles: 3 }))], options);

  assert.deepEqual(parsed[0]!.waves[0], {
    id: 'W1',
    trigger: { type: 'TIME', frame: 30 },
    spawn: { enemyId: 'enemy', count: 4, intervalFrames: 20, magnificationPermille: 1000 },
    repeat: { delayFrames: 180, maxCycles: 3 },
  });
});

test('repeat delay without maxCycles represents an indefinite battle-long pattern', () => {
  const parsed = parseCampaignStages([stage(wave({ delayFrames: 300 }))], options);
  assert.equal(parsed[0]!.waves[0]!.repeat?.delayFrames, 300);
  assert.equal(parsed[0]!.waves[0]!.repeat?.maxCycles, undefined);
});

test('repeat object cannot omit its delay', () => {
  assert.throws(
    () => parseCampaignStages([stage(wave({ maxCycles: 2 }))], options),
    /repeat\.delayFrames must be an integer/,
  );
});

test('repeat delays must be positive', () => {
  assert.throws(
    () => parseCampaignStages([stage(wave({ delayFrames: 0 }))], options),
    /repeat\.delayFrames must be an integer in 1/,
  );
});
