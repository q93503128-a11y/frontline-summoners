import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOSS_SOURCE_REFERENCE,
  BOSS_SOURCE_REFERENCE_ART_FAMILIES,
} from '../src/boss-source-reference-art.ts';
import { NORMAL_ENEMY_SOURCE_REFERENCE } from '../src/enemy-source-reference-map.ts';
import { resolveUnitArt } from '../src/production-assets.ts';

const EXPECTED_SOURCE_REFERENCE_BOSSES = {
  'enemy-boss': 'cc0-boss-void-squid',
  'enemy-boss-iron': 'cc0-boss-iron-samurai',
  boss_ch2_rootwidow: 'cc0-boss-rootwidow',
  boss_ch2_funeral_king: 'cc0-boss-funeral-king',
  boss_ch3_archmagus: 'cc0-boss-archmagus',
  boss_ch3_belzar: 'cc0-boss-belzar-beast',
  boss_ch4_moving_throne: 'cc0-boss-moving-throne',
} as const;

const STILL_UNMATCHED_BOSSES = [
  'boss_ch4_zero_engine',
] as const;

test('mapped bosses use distinct CC0 boss-grade silhouettes without production approval', () => {
  const sourceReferenceBosses = Object.keys(EXPECTED_SOURCE_REFERENCE_BOSSES);
  assert.deepEqual(new Set(Object.keys(BOSS_SOURCE_REFERENCE)), new Set(sourceReferenceBosses));
  assert.equal(BOSS_SOURCE_REFERENCE_ART_FAMILIES.length, sourceReferenceBosses.length);

  const normalFamilies = new Set(Object.values(NORMAL_ENEMY_SOURCE_REFERENCE).map((variant) => variant.familyId));
  const bossFamilies = sourceReferenceBosses.map((unitId) => BOSS_SOURCE_REFERENCE[unitId]!.familyId);
  assert.equal(new Set(bossFamilies).size, sourceReferenceBosses.length,
    'bosses must not share one recoloured or scaled body');

  for (const [unitId, familyId] of Object.entries(EXPECTED_SOURCE_REFERENCE_BOSSES)) {
    const expected = BOSS_SOURCE_REFERENCE[unitId]!;
    const art = resolveUnitArt(unitId);
    assert.equal(expected.familyId, familyId, `${unitId} expected family drifted`);
    assert.equal(art.source, 'PLACEHOLDER', `${unitId} must remain source-reference art`);
    assert.equal(art.productionAssetId, undefined, `${unitId} must not claim production approval`);
    assert.equal(art.family.id, familyId, `${unitId} boss source-reference mapping drifted`);
    assert.equal(art.tint, 0xffffff, `${unitId} must preserve the authored source palette`);
    assert.equal(normalFamilies.has(art.family.id), false, `${unitId} must not reuse a normal-enemy family`);
    assert.ok(art.family.displayHeight >= 240, `${unitId} needs deliberate boss-scale screen occupancy`);
    assert.ok(art.family.knockback, `${unitId} must expose a hit reaction`);
    assert.ok(art.family.death, `${unitId} must expose a death reaction`);
    assert.match(art.family.idle.url, /^\/assets\/characters\/boss-source-reference\//);
  }
});

test('Rootwidow uses a deliberate giant nature boss footprint', () => {
  const art = resolveUnitArt('boss_ch2_rootwidow');
  assert.equal(art.family.id, 'cc0-boss-rootwidow');
  assert.ok(art.family.displayHeight >= 280, 'Rootwidow must read larger than ordinary units');
  assert.equal(art.tint, 0xffffff, 'Rootwidow must keep the authored source palette');
});

test('Moving Throne uses a deliberate heavy mechanical boss footprint', () => {
  const art = resolveUnitArt('boss_ch4_moving_throne');
  assert.equal(art.family.id, 'cc0-boss-moving-throne');
  assert.ok(art.family.displayHeight >= 300, 'Moving Throne must dominate more screen space than ordinary units');
  assert.equal(art.tint, 0xffffff, 'Moving Throne must keep the authored source palette');
});

test('unmatched chapter bosses remain outside the source-reference override', () => {
  for (const bossId of STILL_UNMATCHED_BOSSES) {
    assert.equal(BOSS_SOURCE_REFERENCE[bossId], undefined,
      `${bossId} must stay untouched until a matching boss-grade source is found`);
  }
});
