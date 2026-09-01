import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { UnitState, type BattleUnit } from '@frontline/sim';
import type { SpriteStrip } from '../src/assets.ts';
import {
  getRuntimeMotionFrame,
  selectRuntimeMotionStrip,
  usesAuthoredDeathMotion,
  usesAuthoredKnockbackMotion,
} from '../src/production-motion.ts';
import type { RuntimeArtFamily } from '../src/production-assets.ts';

function strip(key: string, frames = 4): SpriteStrip {
  return {
    key,
    url: `/assets/production/test/${key}.png`,
    frameWidth: 64,
    frameHeight: 64,
    frames,
  };
}

const idle = strip('idle', 3);
const run = strip('run', 5);
const attack = strip('attack', 6);
const knockback = strip('knockback', 4);
const death = strip('death', 5);
const family: RuntimeArtFamily = {
  id: 'production-test',
  idle,
  run,
  attack,
  knockback,
  death,
  displayHeight: 128,
  attackContactFrame: 2,
};

test('production motion resolver selects authored knockback and death strips only when supplied', () => {
  assert.equal(selectRuntimeMotionStrip(family, UnitState.NaturalKnockback), knockback);
  assert.equal(selectRuntimeMotionStrip(family, UnitState.Dying), death);
  assert.equal(selectRuntimeMotionStrip(family, UnitState.Moving), run);
  assert.equal(selectRuntimeMotionStrip(family, UnitState.Foreswing), attack);
  assert.equal(selectRuntimeMotionStrip(family, UnitState.Standing), idle);
  assert.equal(usesAuthoredKnockbackMotion(family, UnitState.NaturalKnockback), true);
  assert.equal(usesAuthoredDeathMotion(family, UnitState.Dying), true);

  const placeholder: RuntimeArtFamily = { ...family, knockback: undefined, death: undefined };
  assert.equal(selectRuntimeMotionStrip(placeholder, UnitState.NaturalKnockback), idle);
  assert.equal(selectRuntimeMotionStrip(placeholder, UnitState.Dying), idle);
  assert.equal(usesAuthoredKnockbackMotion(placeholder, UnitState.NaturalKnockback), false);
  assert.equal(usesAuthoredDeathMotion(placeholder, UnitState.Dying), false);
});

test('authored death frames progress deterministically and clamp to the final sprite frame', () => {
  const unit = {
    state: UnitState.Dying,
    stateFrame: 0,
    simulationId: 77,
    definition: { deathFrames: 10 },
  } as unknown as BattleUnit;

  assert.equal(getRuntimeMotionFrame(family, death, unit, 100), 0);
  (unit as { stateFrame: number }).stateFrame = 4;
  assert.equal(getRuntimeMotionFrame(family, death, unit, 100), 2);
  (unit as { stateFrame: number }).stateFrame = 9;
  assert.equal(getRuntimeMotionFrame(family, death, unit, 100), 4);
  (unit as { stateFrame: number }).stateFrame = 99;
  assert.equal(getRuntimeMotionFrame(family, death, unit, 100), 4);
});

test('battle and deck scenes consume the shared production runtime instead of legacy art mapping', async () => {
  const battleSource = await readFile(new URL('../src/battle-scene.ts', import.meta.url), 'utf8');
  const deckSource = await readFile(new URL('../src/deck-scene.ts', import.meta.url), 'utf8');

  assert.match(battleSource, /selectRuntimeMotionStrip\(art\.family, unit\.state\)/);
  assert.match(battleSource, /getRuntimeMotionFrame\(art\.family, strip, unit, this\.state\.battle\.tick\)/);
  assert.match(battleSource, /usesAuthoredDeathMotion\(art\.family, unit\.state\)/);
  assert.doesNotMatch(battleSource, /private stripForState\(/);
  assert.doesNotMatch(battleSource, /private frameForState\(/);

  assert.match(deckSource, /resolveUnitArt\(slot\.definition\.id, meta\?\.selectedFormId\)/);
  assert.doesNotMatch(deckSource, /UNIT_ART/);
  assert.doesNotMatch(deckSource, /ART_BY_ID/);
  assert.doesNotMatch(deckSource, /ART_FAMILIES/);
});
