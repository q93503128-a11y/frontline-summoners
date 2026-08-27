import assert from 'node:assert/strict';
import test from 'node:test';
import { SPECIAL_STAGES, STAGES } from '../src/prototype.ts';

test('canonical repeat blocks use positive frame delays and never the removed flat repeat fields', () => {
  const stages = [...STAGES, ...SPECIAL_STAGES];
  const repeatingWaves = stages.flatMap((stage) => stage.waves.filter((wave) => wave.repeat !== undefined));
  assert.ok(repeatingWaves.length > 0, 'current content must exercise the repeat-wave engine');
  for (const wave of repeatingWaves) {
    assert.ok((wave.repeat?.delayFrames ?? 0) > 0);
    if (wave.repeat?.maxCycles !== undefined) assert.ok(wave.repeat.maxCycles > 0);
    assert.equal('repeatDelayTicks' in wave, false);
  }
});

test('rush special has multiple independently recurring patterns', () => {
  const rush = SPECIAL_STAGES.find((stage) => stage.id === 'special-02');
  assert.ok(rush);
  assert.ok(rush.waves.filter((wave) => wave.repeat !== undefined).length >= 2);
});

test('current boss appearances are one-shot by content choice, not an engine rule', () => {
  const bossWaves = [...STAGES, ...SPECIAL_STAGES]
    .flatMap((stage) => stage.waves)
    .filter((wave) => wave.spawn.enemyId === 'enemy-boss' || wave.spawn.enemyId === 'enemy-boss-iron');
  assert.ok(bossWaves.length > 0);
  assert.ok(bossWaves.every((wave) => wave.repeat === undefined));
});
