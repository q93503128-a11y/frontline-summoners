import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOSS_SOURCE_REFERENCE,
  BOSS_SOURCE_REFERENCE_ART_FAMILIES,
} from '../src/boss-source-reference-art.ts';
import { NORMAL_ENEMY_SOURCE_REFERENCE } from '../src/enemy-source-reference-map.ts';
import { resolveUnitArt } from '../src/production-assets.ts';

const SOURCE_REFERENCE_BOSSES = ['enemy-boss', 'enemy-boss-iron'] as const;
const REVIEW_RESERVED_BOSSES = [
  'boss_ch2_rootwidow',
  'boss_ch2_funeral_king',
  'boss_ch3_archmagus',
  'boss_ch3_belzar',
  'boss_ch4_moving_throne',
  'boss_ch4_zero_engine',
] as const;

test('chapter-one bosses use distinct CC0 boss-pack silhouettes without production approval', () => {
  assert.deepEqual(new Set(Object.keys(BOSS_SOURCE_REFERENCE)), new Set(SOURCE_REFERENCE_BOSSES));
  assert.equal(BOSS_SOURCE_REFERENCE_ART_FAMILIES.length, 2);

  const normalFamilies = new Set(Object.values(NORMAL_ENEMY_SOURCE_REFERENCE).map((variant) => variant.familyId));
  const bossFamilies = SOURCE_REFERENCE_BOSSES.map((unitId) => BOSS_SOURCE_REFERENCE[unitId]!.familyId);
  assert.equal(new Set(bossFamilies).size, 2, 'bosses must not share one recoloured body');

  for (const unitId of SOURCE_REFERENCE_BOSSES) {
    const expected = BOSS_SOURCE_REFERENCE[unitId]!;
    const art = resolveUnitArt(unitId);
    assert.equal(art.source, 'PLACEHOLDER', `${unitId} must remain source-reference art`);
    assert.equal(art.productionAssetId, undefined, `${unitId} must not claim production approval`);
    assert.equal(art.family.id, expected.familyId, `${unitId} boss source-reference mapping drifted`);
    assert.equal(art.tint, 0xffffff, `${unitId} must preserve the authored source palette`);
    assert.equal(normalFamilies.has(art.family.id), false, `${unitId} must not reuse a normal-enemy family`);
    assert.ok(art.family.displayHeight >= 240, `${unitId} needs deliberate boss-scale screen occupancy`);
    assert.ok(art.family.knockback, `${unitId} must expose a hit reaction`);
    assert.ok(art.family.death, `${unitId} must expose a death reaction`);
    assert.match(art.family.idle.url, /^\/assets\/characters\/boss-source-reference\//);
  }
});

test('chapter two through four review bosses remain outside the source-reference override', () => {
  for (const bossId of REVIEW_RESERVED_BOSSES) {
    assert.equal(BOSS_SOURCE_REFERENCE[bossId], undefined, `${bossId} must stay reserved for visual approval`);
  }
});
