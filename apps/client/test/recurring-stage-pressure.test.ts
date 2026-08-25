import assert from 'node:assert/strict';
import test from 'node:test';
import { SPECIAL_STAGES, STAGES } from '../src/prototype.ts';

test('every current playable stage keeps at least one recurring enemy pressure pattern', () => {
  for (const stage of [...STAGES, ...SPECIAL_STAGES]) {
    assert.ok(
      stage.waves.some((wave) => wave.repeatDelayTicks !== undefined),
      `${stage.id} would become permanently empty after its finite waves`,
    );
  }
});

test('rush special has multiple independently recurring patterns', () => {
  const rush = SPECIAL_STAGES.find((stage) => stage.id === 'special-02');
  assert.ok(rush);
  assert.ok(rush.waves.filter((wave) => wave.repeatDelayTicks !== undefined).length >= 2);
});

test('current boss appearances are one-shot by content choice, not an engine rule', () => {
  const bossWaves = [...STAGES, ...SPECIAL_STAGES]
    .flatMap((stage) => stage.waves)
    .filter((wave) => wave.enemyId === 'enemy-boss' || wave.enemyId === 'enemy-boss-iron');
  assert.ok(bossWaves.length > 0);
  assert.ok(bossWaves.every((wave) => wave.repeatDelayTicks === undefined));
});
