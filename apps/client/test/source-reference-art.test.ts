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
]);

test('every vetted source-reference family exposes authored or source-derived hit and death strips', () => {
  assert.equal(SOURCE_REFERENCE_ART_FAMILIES.length, EXPECTED_REACTIONS.size);
  assert.equal(new Set(SOURCE_REFERENCE_ART_FAMILIES.map((family) => family.id)).size, SOURCE_REFERENCE_ART_FAMILIES.length);

  for (const [familyId, [hitFrames, deathFrames]] of EXPECTED_REACTIONS) {
    const family = SOURCE_REFERENCE_ART_BY_ID[familyId];
    assert.ok(family, `missing source-reference family: ${familyId}`);
    assert.ok(family.knockback, `${familyId} must expose a hit strip`);
    assert.ok(family.death, `${familyId} must expose a death strip`);
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

test('verified free references distinguish selected story final forms without claiming production approval', () => {
  const hunterF1 = resolveUnitArt('hunter', 'hunter_f1');
  const hunterF3 = resolveUnitArt('hunter', 'hunter_f3');
  const duelistF1 = resolveUnitArt('duelist', 'duelist_f1');
  const duelistF3 = resolveUnitArt('duelist', 'duelist_f3');
  const royalF1 = resolveUnitArt('royal', 'royal_f1');
  const royalF3 = resolveUnitArt('royal', 'royal_f3');
  const hereticF1 = resolveUnitArt('heretic', 'heretic_f1');
  const hereticF3 = resolveUnitArt('heretic', 'heretic_f3');

  assert.equal(hunterF1.family.id, 'huntress');
  assert.equal(hunterF3.family.id, 'huntress-2');
  assert.equal(duelistF1.family.id, 'fantasy-warrior');
  assert.equal(duelistF3.family.id, 'martial-hero-2');
  assert.equal(royalF1.family.id, 'hero-knight');
  assert.equal(royalF3.family.id, 'king-2');
  assert.equal(hereticF1.family.id, 'evil-wizard');
  assert.equal(hereticF3.family.id, 'evil-wizard-2');

  const resolved = [hunterF1, hunterF3, duelistF1, duelistF3, royalF1, royalF3, hereticF1, hereticF3];
  assert.ok(resolved.every((art) => art.source === 'PLACEHOLDER'));
  assert.ok(resolved.every((art) => art.productionAssetId === undefined));
  assert.ok(resolved.every((art) => art.family.knockback && art.family.death));
});

test('lower-rarity clockduck and ink-raven forms use free creature silhouettes without production approval', () => {
  const clockduck = [1, 2, 3].map((order) => resolveUnitArt('char_common_b_clockduck', `char_common_b_clockduck_f${order}`));
  const raven = [1, 2, 3].map((order) => resolveUnitArt('char_common_b_ink_raven', `char_common_b_ink_raven_f${order}`));

  assert.deepEqual(clockduck.map((art) => art.family.id), ['cc0-clockduck-f1', 'cc0-clockduck-f1', 'cc0-clockduck-f3']);
  assert.deepEqual(raven.map((art) => art.family.id), ['cc0-ink-raven-f1', 'cc0-ink-raven-f2', 'cc0-ink-raven-f3']);
  assert.ok([...clockduck, ...raven].every((art) => art.source === 'PLACEHOLDER'));
  assert.ok([...clockduck, ...raven].every((art) => art.productionAssetId === undefined));
  assert.ok([...clockduck, ...raven].every((art) => art.family.knockback && art.family.death));
});

test('bell-crab and lantern-moth use six distinct Foozle creature forms without production approval', () => {
  const crab = [1, 2, 3].map((order) => resolveUnitArt('char_common_c_bell_crab', `char_common_c_bell_crab_f${order}`));
  const moth = [1, 2, 3].map((order) => resolveUnitArt('char_common_c_lantern_moth', `char_common_c_lantern_moth_f${order}`));

  assert.deepEqual(crab.map((art) => art.family.id), ['cc0-bell-crab-f1', 'cc0-bell-crab-f2', 'cc0-bell-crab-f3']);
  assert.deepEqual(moth.map((art) => art.family.id), ['cc0-lantern-moth-f1', 'cc0-lantern-moth-f2', 'cc0-lantern-moth-f3']);
  assert.equal(new Set([...crab, ...moth].map((art) => art.family.id)).size, 6);
  assert.ok([...crab, ...moth].every((art) => art.source === 'PLACEHOLDER'));
  assert.ok([...crab, ...moth].every((art) => art.productionAssetId === undefined));
  assert.ok([...crab, ...moth].every((art) => art.family.knockback && art.family.death));
  assert.ok([...crab, ...moth].every((art) => art.family.idle.url.startsWith('/assets/characters/lower-rarity/')));
});

test('tin-squire uses three finished GrafxKid robot forms without production approval', () => {
  const forms = [1, 2, 3].map((order) => resolveUnitArt('char_common_c_tin_squire', `char_common_c_tin_squire_f${order}`));

  assert.deepEqual(forms.map((art) => art.family.id), ['cc0-tin-squire-f1', 'cc0-tin-squire-f2', 'cc0-tin-squire-f3']);
  assert.equal(new Set(forms.map((art) => art.family.id)).size, 3);
  assert.ok(forms.every((art) => art.source === 'PLACEHOLDER'));
  assert.ok(forms.every((art) => art.productionAssetId === undefined));
  assert.ok(forms.every((art) => art.family.knockback && art.family.death));
  assert.ok(forms.every((art) => art.family.idle.url.startsWith('/assets/characters/lower-rarity/')));
});

test('golden-mask boss reservation remains placeholder while using complete Evil Wizard source motion', () => {
  const boss = resolveUnitArt('enemy-boss');
  assert.equal(boss.source, 'PLACEHOLDER');
  assert.equal(boss.productionAssetId, undefined);
  assert.equal(boss.family.id, 'evil-wizard');
  assert.ok(boss.family.knockback);
  assert.ok(boss.family.death);
});
