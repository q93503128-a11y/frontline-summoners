import assert from 'node:assert/strict';
import test from 'node:test';
import { STAGES } from '../src/prototype.ts';
import { getUnlockedBaseWeaponIds, normalizeSelectedBaseWeaponId } from '../src/base-weapon-progression.ts';

const through = (stageId: string): readonly string[] => {
  const index = STAGES.findIndex((stage) => stage.id === stageId);
  return STAGES.slice(0, index + 1).map((stage) => stage.id);
};

test('base weapon unlock progression follows the v1 milestones', () => {
  assert.deepEqual(getUnlockedBaseWeaponIds([]), ['base_weapon_front_cannon']);
  assert.deepEqual(getUnlockedBaseWeaponIds(through('main_02_010')), ['base_weapon_front_cannon', 'base_weapon_aegis_emitter']);
  assert.deepEqual(getUnlockedBaseWeaponIds(through('main_03_010')), ['base_weapon_front_cannon', 'base_weapon_aegis_emitter', 'base_weapon_supply_drop']);
});

test('locked or unknown selected weapon falls back to front cannon', () => {
  assert.equal(normalizeSelectedBaseWeaponId('base_weapon_supply_drop', through('main_01_020')), 'base_weapon_front_cannon');
  assert.equal(normalizeSelectedBaseWeaponId('base_weapon_supply_drop', through('main_03_010')), 'base_weapon_supply_drop');
  assert.equal(normalizeSelectedBaseWeaponId('not-a-weapon', through('main_04_020')), 'base_weapon_front_cannon');
});
