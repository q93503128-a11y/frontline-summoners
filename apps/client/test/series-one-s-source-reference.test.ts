import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SERIES_ONE_S_PLACEHOLDER_FORM_ART,
  SERIES_ONE_S_SOURCE_REFERENCE_ART_FAMILIES,
} from '../src/series-one-s-source-reference-art.ts';
import { PRODUCTION_UNIT_ART_CANDIDATES, resolveUnitArt } from '../src/production-assets.ts';
import { SOURCE_REFERENCE_ART_BY_ID } from '../src/source-reference-art.ts';

const CHARACTERS = ['elsia', 'riena', 'mireille', 'neria', 'totoria'] as const;

test('Series 1 S pass covers five characters and fifteen authored source-reference forms', () => {
  assert.equal(Object.keys(SERIES_ONE_S_PLACEHOLDER_FORM_ART).length, 15);
  assert.equal(SERIES_ONE_S_SOURCE_REFERENCE_ART_FAMILIES.length, 15);
  assert.equal(PRODUCTION_UNIT_ART_CANDIDATES.length, 0, 'S source references must not bypass production approval');

  for (const character of CHARACTERS) {
    const familyIds: string[] = [];
    const attackUrls: string[] = [];
    for (const order of [1, 2, 3] as const) {
      const formId = `char_s01_${character}_f${order}`;
      const expected = SERIES_ONE_S_PLACEHOLDER_FORM_ART[formId];
      assert.ok(expected, `${formId} must have a curated source-reference mapping`);

      const art = resolveUnitArt(`char_s01_${character}`, formId);
      assert.equal(art.source, 'PLACEHOLDER');
      assert.equal(art.productionAssetId, undefined);
      assert.equal(art.tint, 0xffffff, `${formId} must preserve authored palette`);
      assert.equal(art.family.id, expected.familyId);
      assert.equal(SOURCE_REFERENCE_ART_BY_ID[art.family.id]?.id, art.family.id);
      assert.ok(art.family.knockback, `${formId} must expose authored reaction art`);
      assert.ok(art.family.death, `${formId} must expose authored death art`);
      assert.match(art.family.idle.url, /^\/assets\/characters\/series-one-s-source-reference\//);
      familyIds.push(art.family.id);
      attackUrls.push(art.family.attack.url);
    }
    assert.equal(new Set(familyIds).size, 3, `${character} F1/F2/F3 must remain separately addressable`);
    assert.equal(new Set(attackUrls).size, 3, `${character} evolution forms must use distinct authored attack sequences`);
  }
});

test('Arselia remains outside this S source-reference pass', () => {
  for (const formId of [
    'char_s01_arselia_f1', 'char_s01_arselia_f2', 'char_s01_arselia_f3',
  ]) {
    assert.equal(SERIES_ONE_S_PLACEHOLDER_FORM_ART[formId], undefined);
  }
});
