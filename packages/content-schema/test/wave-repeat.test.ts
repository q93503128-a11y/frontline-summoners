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
  treasure: { id: 'test-treasure', name: 'test', effect: 'test' },
});

const options = { enemyIds: new Set(['enemy']) };

test('campaign wave parser preserves optional repeat-cycle controls', () => {
  const parsed = parseCampaignStages([stage({
    enemyId: 'enemy',
    atTick: 30,
    count: 4,
    intervalTicks: 20,
    repeatDelayTicks: 180,
    maxCycles: 3,
  })], options);

  assert.deepEqual(parsed[0]!.waves[0], {
    enemyId: 'enemy',
    atTick: 30,
    count: 4,
    intervalTicks: 20,
    repeatDelayTicks: 180,
    maxCycles: 3,
  });
});

test('repeatDelayTicks without maxCycles represents an indefinite battle-long pattern', () => {
  const parsed = parseCampaignStages([stage({
    enemyId: 'enemy', atTick: 0, count: 1, intervalTicks: 30, repeatDelayTicks: 300,
  })], options);
  assert.equal(parsed[0]!.waves[0]!.repeatDelayTicks, 300);
  assert.equal(parsed[0]!.waves[0]!.maxCycles, undefined);
});

test('maxCycles cannot silently turn a one-shot wave into an underspecified repeat', () => {
  assert.throws(() => parseCampaignStages([stage({
    enemyId: 'enemy', atTick: 0, count: 1, intervalTicks: 30, maxCycles: 2,
  })], options), /maxCycles requires repeatDelayTicks/);
});

test('repeat delays must be positive', () => {
  assert.throws(() => parseCampaignStages([stage({
    enemyId: 'enemy', atTick: 0, count: 1, intervalTicks: 30, repeatDelayTicks: 0,
  })], options), /repeatDelayTicks must be an integer/);
});
