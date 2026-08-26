import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMBAT_TAGS,
  MIN_PLAYER_RECHARGE_FRAMES,
  parsePlayerUnits,
} from '../src/index.ts';

function unit(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'schema-test-unit',
    displayName: '스키마 테스트 유닛',
    acquisitionClass: 'STORY',
    rarity: null,
    role: '전열',
    description: 'canonical schema validation fixture',
    maxHp: 100,
    attackDamage: 10,
    moveSpeed: 1,
    standingRange: 40,
    attackMinRange: 0,
    attackMaxRange: 50,
    cycleFrames: 30,
    hitFrames: [10],
    backswingFrames: 5,
    naturalKnockbackCount: 1,
    targetMode: 'SINGLE',
    attributes: ['NEUTRAL'],
    combatTags: [],
    damageBonuses: [],
    cost: 100,
    rechargeFrames: MIN_PLAYER_RECHARGE_FRAMES,
    ...overrides,
  };
}

test('canonical combat tag namespace uses FLOATING and rejects FLYING', () => {
  assert.ok(COMBAT_TAGS.includes('FLOATING'));
  assert.ok(COMBAT_TAGS.includes('SWARM'));
  assert.equal((COMBAT_TAGS as readonly string[]).includes('FLYING'), false);
  assert.throws(() => parsePlayerUnits([unit({ combatTags: ['FLYING'] })]), /combatTags\[0\] is unknown: FLYING/);
});

test('player unit content cannot define recharge below the locked 60F floor', () => {
  assert.equal(MIN_PLAYER_RECHARGE_FRAMES, 60);
  assert.doesNotThrow(() => parsePlayerUnits([unit()]));
  assert.throws(
    () => parsePlayerUnits([unit({ rechargeFrames: MIN_PLAYER_RECHARGE_FRAMES - 1 })]),
    /rechargeFrames must be an integer in 60\.\.36000/,
  );
});
