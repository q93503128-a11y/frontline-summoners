import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SERIES_ONE_S_PLACEHOLDER_FORM_ART,
  SERIES_ONE_S_SOURCE_REFERENCE_ART_FAMILIES,
} from '../src/series-one-s-source-reference-art.ts';
import { PRODUCTION_UNIT_ART_CANDIDATES, resolveUnitArt } from '../src/production-assets.ts';
import { SOURCE_REFERENCE_ART_BY_ID } from '../src/source-reference-art.ts';

const CHARACTERS = ['elsia', 'riena', 'mireille', 'neria', 'totoria'] as const;

function seriesOneReviewFamilies() {
  return SERIES_ONE_S_SOURCE_REFERENCE_ART_FAMILIES.filter((family) => family.id.startsWith('s01-'));
}

function seriesOneRuntimeMappings() {
  return Object.entries(SERIES_ONE_S_PLACEHOLDER_FORM_ART).filter(([formId]) => formId.startsWith('char_s01_'));
}

test('Series 1 S retains fifteen generated review forms but keeps them out of live battle authority', () => {
  const reviewFamilies = seriesOneReviewFamilies();
  const runtimeMappings = seriesOneRuntimeMappings();
  assert.equal(reviewFamilies.length, 15);
  assert.equal(runtimeMappings.length, 15);
  assert.equal(PRODUCTION_UNIT_ART_CANDIDATES.length, 0, 'S source references must not bypass production approval');

  for (const family of reviewFamilies) {
    assert.match(family.id, /^s01-/);
    assert.match(family.idle.url, /^\/assets\/characters\/series-one-s-source-reference\//);
    assert.ok(family.knockback);
    assert.ok(family.death);
  }

  for (const [formId, mapping] of runtimeMappings) {
    assert.ok(!mapping.familyId.startsWith('s01-'), `${formId} must not use the rejected assembled composite in live battle`);
    assert.ok(SOURCE_REFERENCE_ART_BY_ID[mapping.familyId], `${formId} must fall back to a vetted complete-character family`);
  }
});

test('Series 1 S live forms resolve to coherent vetted placeholders without production claims', () => {
  for (const character of CHARACTERS) {
    for (const order of [1, 2, 3] as const) {
      const formId = `char_s01_${character}_f${order}`;
      const expected = SERIES_ONE_S_PLACEHOLDER_FORM_ART[formId];
      assert.ok(expected, `${formId} must have a deliberate runtime fallback mapping`);

      const art = resolveUnitArt(`char_s01_${character}`, formId);
      assert.equal(art.source, 'PLACEHOLDER');
      assert.equal(art.productionAssetId, undefined);
      assert.equal(art.family.id, expected.familyId);
      assert.ok(!art.family.id.startsWith('s01-'), `${formId} must remain off the broken composite sheets`);
      assert.equal(SOURCE_REFERENCE_ART_BY_ID[art.family.id]?.id, art.family.id);
      assert.ok(art.family.knockback, `${formId} must expose a complete hit reaction`);
      assert.ok(art.family.death, `${formId} must expose a complete death reaction`);
    }
  }
});

test('Arselia remains outside this S source-reference pass', () => {
  for (const formId of [
    'char_s01_arselia_f1', 'char_s01_arselia_f2', 'char_s01_arselia_f3',
  ]) {
    assert.equal(SERIES_ONE_S_PLACEHOLDER_FORM_ART[formId], undefined);
  }
});
