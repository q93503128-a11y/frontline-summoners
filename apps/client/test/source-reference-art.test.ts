import assert from 'node:assert/strict';
import test from 'node:test';
import { clearActiveVisualForms } from '../src/active-visual-forms.ts';
import { resolveUnitArt } from '../src/production-assets.ts';
import { PLAYER_SLOTS } from '../src/prototype.ts';
import { SOURCE_REFERENCE_ART_BY_ID, SOURCE_REFERENCE_ART_FAMILIES } from '../src/source-reference-art.ts';

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
]);

test('every pinned source-reference family exposes authored hit and death strips', () => {
  assert.equal(SOURCE_REFERENCE_ART_FAMILIES.length, EXPECTED_REACTIONS.size);
  assert.equal(new Set(SOURCE_REFERENCE_ART_FAMILIES.map((family) => family.id)).size, SOURCE_REFERENCE_ART_FAMILIES.length);

  for (const [familyId, [hitFrames, deathFrames]] of EXPECTED_REACTIONS) {
    const family = SOURCE_REFERENCE_ART_BY_ID[familyId];
    assert.ok(family, `missing source-reference family: ${familyId}`);
    assert.ok(family.knockback, `${familyId} must expose an authored hit strip`);
    assert.ok(family.death, `${familyId} must expose an authored death strip`);
    assert.equal(family.knockback.frames, hitFrames, `${familyId} hit frame count drifted`);
    assert.equal(family.death.frames, deathFrames, `${familyId} death frame count drifted`);
    assert.match(family.knockback.url, /^\/assets\/characters\//);
    assert.match(family.death.url, /^\/assets\/characters\//);
  }
});

test('all ten chapter-one story units resolve to complete five-motion placeholder families', () => {
  assert.equal(PLAYER_SLOTS.length, 10);
  clearActiveVisualForms();

  for (const slot of PLAYER_SLOTS) {
    const art = resolveUnitArt(slot.slotId);
    assert.equal(art.source, 'PLACEHOLDER', `${slot.slotId} must remain unapproved source-reference art`);
    assert.equal(art.productionAssetId, undefined);
    assert.ok(art.family.knockback, `${slot.slotId} must have an authored placeholder hit reaction`);
    assert.ok(art.family.death, `${slot.slotId} must have an authored placeholder death motion`);
    assert.ok(EXPECTED_REACTIONS.has(art.family.id), `${slot.slotId} resolved to an unverified reaction family: ${art.family.id}`);
  }

  clearActiveVisualForms();
});

test('verified CC0 references distinguish hunter and royal final forms without claiming production approval', () => {
  const hunterF1 = resolveUnitArt('hunter', 'hunter_f1');
  const hunterF3 = resolveUnitArt('hunter', 'hunter_f3');
  const royalF1 = resolveUnitArt('royal', 'royal_f1');
  const royalF3 = resolveUnitArt('royal', 'royal_f3');

  assert.equal(hunterF1.family.id, 'huntress');
  assert.equal(hunterF3.family.id, 'huntress-2');
  assert.equal(royalF1.family.id, 'hero-knight');
  assert.equal(royalF3.family.id, 'king-2');
  assert.ok([hunterF1, hunterF3, royalF1, royalF3].every((art) => art.source === 'PLACEHOLDER'));
  assert.ok([hunterF1, hunterF3, royalF1, royalF3].every((art) => art.productionAssetId === undefined));
  assert.ok(hunterF3.family.knockback && hunterF3.family.death);
  assert.ok(royalF3.family.knockback && royalF3.family.death);
});

test('golden-mask boss reservation remains placeholder while using complete Evil Wizard source motion', () => {
  const boss = resolveUnitArt('enemy-boss');
  assert.equal(boss.source, 'PLACEHOLDER');
  assert.equal(boss.productionAssetId, undefined);
  assert.equal(boss.family.id, 'evil-wizard');
  assert.ok(boss.family.knockback);
  assert.ok(boss.family.death);
});
