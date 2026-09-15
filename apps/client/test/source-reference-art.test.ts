import assert from 'node:assert/strict';
import test from 'node:test';
import { clearActiveVisualForms } from '../src/active-visual-forms.ts';
import { resolveUnitArt } from '../src/production-assets.ts';
import { PLAYER_SLOTS } from '../src/prototype.ts';
import { SOURCE_REFERENCE_ART_BY_ID, SOURCE_REFERENCE_ART_FAMILIES } from '../src/source-reference-art.ts';

const EXPECTED_SOURCE_REFERENCE_FAMILY_COUNT = 92;

const EXPECTED_REACTIONS = new Map<string, readonly [number, number]>([
  ['hero-knight', [4, 11]],
  ['hero-knight-2', [4, 9]],
  ['fantasy-warrior', [3, 7]],
  ['wizard', [4, 7]],
  ['warrior', [4, 6]],
  ['warrior-3', [3, 9]],
  ['huntress', [3, 8]],
  ['evil-wizard', [4, 5]],
  ['warrior-1', [3, 9]],
  ['huntress-2', [3, 10]],
  ['king-2', [4, 6]],
  ['martial-hero-2', [3, 7]],
  ['evil-wizard-2', [3, 7]],
  ['cc0-clockduck-f1', [2, 3]],
  ['cc0-clockduck-f3', [2, 3]],
  ['cc0-ink-raven-f1', [3, 11]],
  ['cc0-ink-raven-f2', [3, 11]],
  ['cc0-ink-raven-f3', [3, 11]],
  ['cc0-bell-crab-f1', [4, 4]],
  ['cc0-bell-crab-f2', [4, 4]],
  ['cc0-bell-crab-f3', [4, 4]],
  ['cc0-lantern-moth-f1', [4, 4]],
  ['cc0-lantern-moth-f2', [4, 4]],
  ['cc0-lantern-moth-f3', [4, 4]],
  ['cc0-tin-squire-f1', [4, 4]],
  ['cc0-tin-squire-f2', [4, 4]],
  ['cc0-tin-squire-f3', [4, 4]],
  ['cc0-turnip-rider-f1', [4, 4]],
  ['cc0-turnip-rider-f2', [4, 4]],
  ['cc0-turnip-rider-f3', [4, 4]],
  ['cc0-slinger-f1', [4, 4]],
  ['cc0-slinger-f2', [4, 4]],
  ['cc0-slinger-f3', [4, 4]],
  ['cc0-coffin-merchant-f1', [4, 4]],
  ['cc0-coffin-merchant-f2', [4, 4]],
  ['cc0-coffin-merchant-f3', [4, 4]],
  ['cc0-moss-golem-f1', [4, 4]],
  ['cc0-moss-golem-f2', [4, 4]],
  ['cc0-moss-golem-f3', [4, 4]],
  ['cc0-glass-keeper-f1', [4, 4]],
  ['cc0-glass-keeper-f2', [4, 4]],
  ['cc0-glass-keeper-f3', [4, 4]],
  ['cc0-bonedrum-f1', [4, 4]],
  ['cc0-bonedrum-f2', [4, 4]],
  ['cc0-bonedrum-f3', [4, 4]],
  ['cc0-paper-dragon-f1', [4, 4]],
  ['cc0-paper-dragon-f2', [4, 4]],
  ['cc0-paper-dragon-f3', [4, 4]],
  ['cc0-meteor-cart-f1', [4, 4]],
  ['cc0-meteor-cart-f2', [4, 4]],
  ['cc0-meteor-cart-f3', [4, 4]],
  ['cc0-mirror-guide-f1', [4, 4]],
  ['cc0-mirror-guide-f2', [4, 4]],
  ['cc0-mirror-guide-f3', [4, 4]],
]);

const FORM_CASES: readonly (readonly [string, string, string])[] = [
  ['hunter', 'hunter_f1', 'huntress'],
  ['hunter', 'hunter_f3', 'huntress-2'],
  ['duelist', 'duelist_f1', 'fantasy-warrior'],
  ['duelist', 'duelist_f3', 'martial-hero-2'],
  ['royal', 'royal_f1', 'hero-knight'],
  ['royal', 'royal_f3', 'king-2'],
  ['heretic', 'heretic_f1', 'evil-wizard'],
  ['heretic', 'heretic_f3', 'evil-wizard-2'],

  ['char_common_b_clockduck', 'char_common_b_clockduck_f1', 'cc0-clockduck-f1'],
  ['char_common_b_clockduck', 'char_common_b_clockduck_f2', 'cc0-clockduck-f1'],
  ['char_common_b_clockduck', 'char_common_b_clockduck_f3', 'cc0-clockduck-f3'],
  ['char_common_b_ink_raven', 'char_common_b_ink_raven_f1', 'cc0-ink-raven-f1'],
  ['char_common_b_ink_raven', 'char_common_b_ink_raven_f2', 'cc0-ink-raven-f2'],
  ['char_common_b_ink_raven', 'char_common_b_ink_raven_f3', 'cc0-ink-raven-f3'],

  ['char_common_c_bell_crab', 'char_common_c_bell_crab_f1', 'cc0-bell-crab-f1'],
  ['char_common_c_bell_crab', 'char_common_c_bell_crab_f2', 'cc0-bell-crab-f2'],
  ['char_common_c_bell_crab', 'char_common_c_bell_crab_f3', 'cc0-bell-crab-f3'],
  ['char_common_c_lantern_moth', 'char_common_c_lantern_moth_f1', 'cc0-lantern-moth-f1'],
  ['char_common_c_lantern_moth', 'char_common_c_lantern_moth_f2', 'cc0-lantern-moth-f2'],
  ['char_common_c_lantern_moth', 'char_common_c_lantern_moth_f3', 'cc0-lantern-moth-f3'],
  ['char_common_c_tin_squire', 'char_common_c_tin_squire_f1', 'cc0-tin-squire-f1'],
  ['char_common_c_tin_squire', 'char_common_c_tin_squire_f2', 'cc0-tin-squire-f2'],
  ['char_common_c_tin_squire', 'char_common_c_tin_squire_f3', 'cc0-tin-squire-f3'],
  ['char_common_c_turnip_rider', 'char_common_c_turnip_rider_f1', 'cc0-turnip-rider-f1'],
  ['char_common_c_turnip_rider', 'char_common_c_turnip_rider_f2', 'cc0-turnip-rider-f2'],
  ['char_common_c_turnip_rider', 'char_common_c_turnip_rider_f3', 'cc0-turnip-rider-f3'],
  ['char_common_c_slinger', 'char_common_c_slinger_f1', 'cc0-slinger-f1'],
  ['char_common_c_slinger', 'char_common_c_slinger_f2', 'cc0-slinger-f2'],
  ['char_common_c_slinger', 'char_common_c_slinger_f3', 'cc0-slinger-f3'],

  ['char_common_b_lantern_witch', 'char_common_b_lantern_witch_f1', 'wizard'],
  ['char_common_b_lantern_witch', 'char_common_b_lantern_witch_f2', 'evil-wizard'],
  ['char_common_b_lantern_witch', 'char_common_b_lantern_witch_f3', 'evil-wizard-2'],
  ['char_common_b_coffin_merchant', 'char_common_b_coffin_merchant_f1', 'cc0-coffin-merchant-f1'],
  ['char_common_b_coffin_merchant', 'char_common_b_coffin_merchant_f2', 'cc0-coffin-merchant-f2'],
  ['char_common_b_coffin_merchant', 'char_common_b_coffin_merchant_f3', 'cc0-coffin-merchant-f3'],
  ['char_common_b_moss_golem', 'char_common_b_moss_golem_f1', 'cc0-moss-golem-f1'],
  ['char_common_b_moss_golem', 'char_common_b_moss_golem_f2', 'cc0-moss-golem-f2'],
  ['char_common_b_moss_golem', 'char_common_b_moss_golem_f3', 'cc0-moss-golem-f3'],

  ['char_common_a_glass_keeper', 'char_common_a_glass_keeper_f1', 'cc0-glass-keeper-f1'],
  ['char_common_a_glass_keeper', 'char_common_a_glass_keeper_f2', 'cc0-glass-keeper-f2'],
  ['char_common_a_glass_keeper', 'char_common_a_glass_keeper_f3', 'cc0-glass-keeper-f3'],
  ['char_common_a_bonedrum', 'char_common_a_bonedrum_f1', 'cc0-bonedrum-f1'],
  ['char_common_a_bonedrum', 'char_common_a_bonedrum_f2', 'cc0-bonedrum-f2'],
  ['char_common_a_bonedrum', 'char_common_a_bonedrum_f3', 'cc0-bonedrum-f3'],
  ['char_common_a_paper_dragon', 'char_common_a_paper_dragon_f1', 'cc0-paper-dragon-f1'],
  ['char_common_a_paper_dragon', 'char_common_a_paper_dragon_f2', 'cc0-paper-dragon-f2'],
  ['char_common_a_paper_dragon', 'char_common_a_paper_dragon_f3', 'cc0-paper-dragon-f3'],
  ['char_common_a_meteor_cart', 'char_common_a_meteor_cart_f1', 'cc0-meteor-cart-f1'],
  ['char_common_a_meteor_cart', 'char_common_a_meteor_cart_f2', 'cc0-meteor-cart-f2'],
  ['char_common_a_meteor_cart', 'char_common_a_meteor_cart_f3', 'cc0-meteor-cart-f3'],
  ['char_common_a_mirror_guide', 'char_common_a_mirror_guide_f1', 'cc0-mirror-guide-f1'],
  ['char_common_a_mirror_guide', 'char_common_a_mirror_guide_f2', 'cc0-mirror-guide-f2'],
  ['char_common_a_mirror_guide', 'char_common_a_mirror_guide_f3', 'cc0-mirror-guide-f3'],
];

test('every vetted source-reference family is unique and exposes complete hit/death reactions', () => {
  assert.equal(SOURCE_REFERENCE_ART_FAMILIES.length, EXPECTED_SOURCE_REFERENCE_FAMILY_COUNT);
  assert.equal(new Set(SOURCE_REFERENCE_ART_FAMILIES.map((family) => family.id)).size, SOURCE_REFERENCE_ART_FAMILIES.length);

  for (const family of SOURCE_REFERENCE_ART_FAMILIES) {
    assert.ok(family.knockback, `${family.id} must expose a hit strip`);
    assert.ok(family.death, `${family.id} must expose a death strip`);
    assert.ok(family.knockback.frames > 0, `${family.id} hit strip must contain frames`);
    assert.ok(family.death.frames > 0, `${family.id} death strip must contain frames`);
    assert.match(family.knockback.url, /^\/assets\/characters\//);
    assert.match(family.death.url, /^\/assets\/characters\//);
  }

  for (const [familyId, [hitFrames, deathFrames]] of EXPECTED_REACTIONS) {
    const family = SOURCE_REFERENCE_ART_BY_ID[familyId];
    assert.ok(family, `missing established source-reference family: ${familyId}`);
    assert.equal(family.knockback?.frames, hitFrames, `${familyId} hit frame count drifted`);
    assert.equal(family.death?.frames, deathFrames, `${familyId} death frame count drifted`);
  }
});

test('all ten chapter-one story units remain unapproved placeholders with complete reactions', () => {
  assert.equal(PLAYER_SLOTS.length, 10);
  clearActiveVisualForms();

  for (const slot of PLAYER_SLOTS) {
    const art = resolveUnitArt(slot.slotId);
    assert.equal(art.source, 'PLACEHOLDER', `${slot.slotId} must remain unapproved source-reference art`);
    assert.equal(art.productionAssetId, undefined);
    assert.ok(art.family.knockback, `${slot.slotId} must have a placeholder hit reaction`);
    assert.ok(art.family.death, `${slot.slotId} must have a placeholder death motion`);
    assert.ok(EXPECTED_REACTIONS.has(art.family.id), `${slot.slotId} resolved to an unverified story reaction family: ${art.family.id}`);
  }

  clearActiveVisualForms();
});

test('vetted story and common forms resolve to their exact source-reference silhouettes without production approval', () => {
  for (const [unitId, formId, expectedFamilyId] of FORM_CASES) {
    const art = resolveUnitArt(unitId, formId);
    assert.equal(art.family.id, expectedFamilyId, `${formId} source-reference family drifted`);
    assert.equal(art.source, 'PLACEHOLDER', `${formId} must remain source-reference art`);
    assert.equal(art.productionAssetId, undefined, `${formId} must not claim production approval`);
    assert.ok(art.family.knockback, `${formId} must have a hit reaction`);
    assert.ok(art.family.death, `${formId} must have a death reaction`);
    if (expectedFamilyId.startsWith('cc0-')) {
      assert.ok(art.family.idle.url.startsWith('/assets/characters/'), `${formId} must stay on vendored source-reference assets`);
    }
  }
});

test('clockduck intentionally reuses its first source silhouette for form two while later forms stay distinct', () => {
  const families = [1, 2, 3].map((order) => resolveUnitArt('char_common_b_clockduck', `char_common_b_clockduck_f${order}`).family.id);
  assert.deepEqual(families, ['cc0-clockduck-f1', 'cc0-clockduck-f1', 'cc0-clockduck-f3']);
});

test('bell-crab and lantern-moth preserve six distinct creature silhouettes', () => {
  const ids = ['char_common_c_bell_crab', 'char_common_c_lantern_moth'] as const;
  const forms = ids.flatMap((unitId) => [1, 2, 3].map((order) => resolveUnitArt(unitId, `${unitId}_f${order}`).family.id));
  assert.equal(new Set(forms).size, 6);
});

test('remaining newly vendored C/B common forms keep twelve distinct CC0 silhouettes', () => {
  const ids = ['char_common_c_turnip_rider', 'char_common_c_slinger', 'char_common_b_coffin_merchant', 'char_common_b_moss_golem'] as const;
  const forms = ids.flatMap((unitId) => [1, 2, 3].map((order) => resolveUnitArt(unitId, `${unitId}_f${order}`).family.id));
  assert.equal(forms.length, 12);
  assert.equal(new Set(forms).size, 12);
});

test('A-rarity common forms keep fifteen distinct CC0 silhouettes', () => {
  const ids = ['char_common_a_glass_keeper', 'char_common_a_bonedrum', 'char_common_a_paper_dragon', 'char_common_a_meteor_cart', 'char_common_a_mirror_guide'] as const;
  const forms = ids.flatMap((unitId) => [1, 2, 3].map((order) => resolveUnitArt(unitId, `${unitId}_f${order}`).family.id));
  assert.equal(forms.length, 15);
  assert.equal(new Set(forms).size, 15);
  assert.ok(forms.every((familyId) => familyId.startsWith('cc0-')));
});

test('chapter-one boss reservation remains placeholder while using its dedicated CC0 boss silhouette', () => {
  const boss = resolveUnitArt('enemy-boss');
  assert.equal(boss.source, 'PLACEHOLDER');
  assert.equal(boss.productionAssetId, undefined);
  assert.equal(boss.family.id, 'cc0-boss-void-squid');
  assert.ok(boss.family.knockback);
  assert.ok(boss.family.death);
  assert.ok(boss.family.idle.url.startsWith('/assets/characters/boss-source-reference/'));
});
