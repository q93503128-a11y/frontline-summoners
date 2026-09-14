import assert from 'node:assert/strict';
import test from 'node:test';
import { NORMAL_ENEMY_SOURCE_REFERENCE, NORMAL_ENEMY_SOURCE_REFERENCE_IDS } from '../src/enemy-source-reference-map.ts';
import { resolveUnitArt } from '../src/production-assets.ts';

const CHAPTER_ONE_ENEMIES = {
  'enemy-raider': 'warrior',
  'enemy-sprinter': 'fantasy-warrior',
  'enemy-spearman': 'huntress',
  'enemy-shield': 'hero-knight-2',
  'enemy-cultist': 'evil-wizard',
  'enemy-sniper': 'wizard',
  'enemy-knight': 'hero-knight',
  'enemy-berserker': 'fantasy-warrior',
} as const;

const LATER_CHAPTER_NORMAL_ENEMIES = [
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

test('all 32 normal chapter enemies remain explicitly mapped without claiming production approval', () => {
  const allIds = [...Object.keys(CHAPTER_ONE_ENEMIES), ...LATER_CHAPTER_NORMAL_ENEMIES];
  assert.equal(NORMAL_ENEMY_SOURCE_REFERENCE_IDS.length, 32);
  assert.deepEqual(new Set(NORMAL_ENEMY_SOURCE_REFERENCE_IDS), new Set(allIds));

  for (const unitId of allIds) {
    const expected = NORMAL_ENEMY_SOURCE_REFERENCE[unitId]!;
    const art = resolveUnitArt(unitId);
    assert.equal(art.source, 'PLACEHOLDER', `${unitId} must remain review-only placeholder art`);
    assert.equal(art.productionAssetId, undefined, `${unitId} must not claim production approval`);
    assert.equal(art.family.id, expected.familyId, `${unitId} source-reference mapping drifted`);
    assert.ok(art.family.knockback, `${unitId} must expose a hit reaction`);
    assert.ok(art.family.death, `${unitId} must expose a death reaction`);
  }
});

test('chapter-one enemies use coherent full-character families instead of unrelated composite parts', () => {
  for (const [unitId, familyId] of Object.entries(CHAPTER_ONE_ENEMIES)) {
    const art = resolveUnitArt(unitId);
    assert.equal(art.family.id, familyId, `${unitId} readability fallback drifted`);
    assert.ok(!art.family.id.startsWith('cc0-'), `${unitId} must not use the rejected composite creature pass`);
  }

  assert.equal(resolveUnitArt('enemy-shield').family.id, 'hero-knight-2', 'shield enemy must stay a readable knight, not an oversized detached shield part');
});

test('later chapter source-reference mappings keep their authored palettes and distinct reviewed silhouettes', () => {
  const families = LATER_CHAPTER_NORMAL_ENEMIES.map((unitId) => {
    const art = resolveUnitArt(unitId);
    assert.equal(art.tint, 0xffffff, `${unitId} must preserve its source palette`);
    assert.match(art.family.idle.url, /^\/assets\/characters\/lower-rarity\//);
    return art.family.id;
  });
  assert.equal(new Set(families).size, LATER_CHAPTER_NORMAL_ENEMIES.length);
});

test('boss reservations are excluded from the normal-enemy visual batch', () => {
  for (const bossId of BOSSES_LEFT_UNTOUCHED) {
    assert.equal(NORMAL_ENEMY_SOURCE_REFERENCE[bossId], undefined, `${bossId} must stay outside normal-enemy source mapping`);
  }
});
