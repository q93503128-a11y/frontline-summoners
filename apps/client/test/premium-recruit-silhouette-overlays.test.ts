import assert from 'node:assert/strict';
import test from 'node:test';
import { EVOLUTION_FORMS } from '../src/character-growth.ts';
import {
  PREMIUM_RECRUIT_UNIT_IDS,
  getPremiumRecruitSilhouetteSpec,
} from '../src/premium-recruit-silhouette-overlays.ts';

const premiumCharacterIds = [...new Set(
  EVOLUTION_FORMS
    .map((form) => form.characterId)
    .filter((characterId) => /^char_s0[123]_/.test(characterId)),
)].sort();

const ssIds = new Set([
  'char_s01_arselia',
  'char_s02_gormu',
  'char_s03_overlay_astra',
]);

test('all 18 S/SS recruitment characters have premium identity scaffolding across all 54 forms', () => {
  assert.equal(premiumCharacterIds.length, 18);
  assert.deepEqual([...PREMIUM_RECRUIT_UNIT_IDS].sort(), premiumCharacterIds);

  const shapes = new Set<string>();
  let coveredForms = 0;
  for (const characterId of premiumCharacterIds) {
    const forms = EVOLUTION_FORMS
      .filter((form) => form.characterId === characterId)
      .sort((a, b) => a.formOrder - b.formOrder);
    assert.equal(forms.length, 3, `premium recruit must keep exactly three canonical forms: ${characterId}`);

    const specs = forms.map((form) => getPremiumRecruitSilhouetteSpec(characterId, form.formId));
    assert.ok(specs.every(Boolean), `missing premium silhouette form: ${characterId}`);
    const [f1, f2, f3] = specs;
    assert.ok(f1 && f2 && f3);
    assert.equal(new Set([f1.key, f2.key, f3.key]).size, 3, `form keys collapsed: ${characterId}`);
    assert.equal(f1.formOrder, 1);
    assert.equal(f2.formOrder, 2);
    assert.equal(f3.formOrder, 3);
    assert.equal(f1.shape, f2.shape);
    assert.equal(f2.shape, f3.shape);
    assert.ok(f1.scale < f2.scale && f2.scale < f3.scale, `premium evolution silhouette progression is unreadable: ${characterId}`);
    assert.equal(f1.rarity, ssIds.has(characterId) ? 'SS' : 'S');
    assert.equal(f2.rarity, f1.rarity);
    assert.equal(f3.rarity, f1.rarity);
    shapes.add(f1.shape);
    coveredForms += 3;
  }

  assert.equal(coveredForms, 54);
  assert.equal(shapes.size, 18, 'S/SS premium characters must not collapse onto shared silhouette identities');
});

test('the three banner SS anchors retain explicit SS treatment', () => {
  for (const characterId of ssIds) {
    const spec = getPremiumRecruitSilhouetteSpec(characterId, `${characterId}_f3`);
    assert.ok(spec);
    assert.equal(spec.rarity, 'SS');
    assert.ok(spec.scale >= 1.25, `SS final form lacks premium silhouette scale: ${characterId}`);
  }
});

test('premium recruitment silhouettes reject mismatched, missing, and unrelated form ids', () => {
  assert.equal(getPremiumRecruitSilhouetteSpec('char_s01_elsia'), undefined);
  assert.equal(getPremiumRecruitSilhouetteSpec('char_s01_elsia', 'char_s01_riena_f1'), undefined);
  assert.equal(getPremiumRecruitSilhouetteSpec('char_s02_gormu', 'char_s02_gormu_f4'), undefined);
  assert.equal(getPremiumRecruitSilhouetteSpec('char_common_a_mirror_guide', 'char_common_a_mirror_guide_f3'), undefined);
  assert.equal(getPremiumRecruitSilhouetteSpec('militia', 'militia_f3'), undefined);
});
