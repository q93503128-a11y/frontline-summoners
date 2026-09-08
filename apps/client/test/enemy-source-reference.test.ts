import assert from 'node:assert/strict';
import test from 'node:test';
import { NORMAL_ENEMY_SOURCE_REFERENCE, NORMAL_ENEMY_SOURCE_REFERENCE_IDS } from '../src/enemy-source-reference-map.ts';
import { resolveUnitArt } from '../src/production-assets.ts';

const CHAPTER_NORMAL_ENEMIES = [
  'enemy-raider',
  'enemy-sprinter',
  'enemy-spearman',
  'enemy-shield',
  'enemy-cultist',
  'enemy-sniper',
  'enemy-knight',
  'enemy-berserker',
  'enemy_ch2_mossboar',
  'enemy_ch2_umbrella',
  'enemy_ch2_vinerider',
  'enemy_ch2_seedbattery',
  'enemy_ch2_bonewheel',
  'enemy_ch2_coffinbug',
  'enemy_ch2_gravebell',
  'enemy_ch2_revivedarmor',
  'enemy_ch3_glasseye',
  'enemy_ch3_spellbug',
  'enemy_ch3_floating_library',
  'enemy_ch3_torn_mirror',
  'enemy_ch3_contract_enforcer',
  'enemy_ch3_inkdemon',
  'enemy_ch3_arcane_battery',
  'enemy_ch3_chain_demon',
  'enemy_ch4_sawbird',
  'enemy_ch4_magnet_spider',
  'enemy_ch4_railworm',
  'enemy_ch4_furnace_golem',
  'enemy_ch4_folded_soldier',
  'enemy_ch4_error_mass',
  'enemy_ch4_void_lens',
  'enemy_ch4_fusion_cavalry',
] as const;

const BOSSES_LEFT_UNTOUCHED = [
  'enemy-boss',
  'enemy-boss-iron',
  'boss_ch2_rootwidow',
  'boss_ch2_funeral_king',
  'boss_ch3_archmagus',
  'boss_ch3_belzar',
  'boss_ch4_moving_throne',
  'boss_ch4_zero_engine',
] as const;

test('all 32 normal chapter enemies use deliberate distinct CC0 source-reference silhouettes', () => {
  assert.equal(NORMAL_ENEMY_SOURCE_REFERENCE_IDS.length, 32);
  assert.deepEqual(new Set(NORMAL_ENEMY_SOURCE_REFERENCE_IDS), new Set(CHAPTER_NORMAL_ENEMIES));

  const configuredFamilies = CHAPTER_NORMAL_ENEMIES.map((unitId) => NORMAL_ENEMY_SOURCE_REFERENCE[unitId]!.familyId);
  assert.equal(new Set(configuredFamilies).size, 32, 'normal enemies must not collapse back into recolors of one body');

  for (const unitId of CHAPTER_NORMAL_ENEMIES) {
    const expected = NORMAL_ENEMY_SOURCE_REFERENCE[unitId]!;
    const art = resolveUnitArt(unitId);
    assert.equal(art.source, 'PLACEHOLDER', `${unitId} must remain source-reference art`);
    assert.equal(art.productionAssetId, undefined, `${unitId} must not claim production approval`);
    assert.equal(art.family.id, expected.familyId, `${unitId} source-reference mapping drifted`);
    assert.equal(art.tint, 0xffffff, `${unitId} must use the authored source palette rather than recolor identity`);
    assert.ok(art.family.knockback, `${unitId} must expose a hit reaction`);
    assert.ok(art.family.death, `${unitId} must expose a death reaction`);
    assert.match(art.family.idle.url, /^\/assets\/characters\/lower-rarity\//);
  }
});

test('boss reservations are excluded from the normal-enemy visual batch', () => {
  for (const bossId of BOSSES_LEFT_UNTOUCHED) {
    assert.equal(NORMAL_ENEMY_SOURCE_REFERENCE[bossId], undefined, `${bossId} must stay outside normal-enemy source mapping`);
  }
});
