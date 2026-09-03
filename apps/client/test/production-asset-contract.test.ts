import assert from 'node:assert/strict';
import test from 'node:test';
import { clearActiveVisualForms, getActiveVisualFormId, syncActiveVisualForms } from '../src/active-visual-forms.ts';
import { EVOLUTION_FORMS } from '../src/character-growth.ts';
import {
  PRODUCTION_AUDIO_REQUIREMENTS,
  PRODUCTION_BATTLEFIELD_REQUIREMENTS,
  PRODUCTION_ENEMY_REQUIREMENTS,
  PRODUCTION_PLAYER_FORM_REQUIREMENTS,
  PRODUCTION_UNIT_ART_CANDIDATES,
  PRODUCTION_UNIT_REQUIREMENTS,
  PRODUCTION_VERTICAL_SLICE,
  getRuntimeArtFamilies,
  getRuntimeSpriteStrips,
  resolveUnitArt,
} from '../src/production-assets.ts';
import { ALL_PLAYER_SLOTS, ENEMIES } from '../src/prototype.ts';

const REQUIRED_MOTIONS = ['idle', 'move', 'attack', 'knockback', 'death'];

test('production contract covers all 43 player characters across all three forms', () => {
  assert.equal(ALL_PLAYER_SLOTS.length, 43);
  assert.equal(EVOLUTION_FORMS.length, 129);
  assert.equal(PRODUCTION_PLAYER_FORM_REQUIREMENTS.length, 129);
  assert.equal(new Set(PRODUCTION_PLAYER_FORM_REQUIREMENTS.map((entry) => entry.unitId)).size, 43);
  for (const slot of ALL_PLAYER_SLOTS) {
    const forms = PRODUCTION_PLAYER_FORM_REQUIREMENTS.filter((entry) => entry.unitId === slot.slotId);
    assert.equal(forms.length, 3, `${slot.slotId} must reserve F1/F2/F3 production art`);
    assert.deepEqual(forms.map((entry) => entry.requiredMotions), [REQUIRED_MOTIONS, REQUIRED_MOTIONS, REQUIRED_MOTIONS]);
  }
});

test('production contract covers every current enemy and keeps approval separate from reservations', () => {
  assert.equal(ENEMIES.length, 80);
  assert.equal(PRODUCTION_ENEMY_REQUIREMENTS.length, ENEMIES.length);
  assert.equal(PRODUCTION_UNIT_REQUIREMENTS.length, 129 + ENEMIES.length);
  assert.ok(PRODUCTION_BATTLEFIELD_REQUIREMENTS.length > 0);
  assert.ok(PRODUCTION_AUDIO_REQUIREMENTS.some((entry) => entry.assetId === 'music:chapter-01'));
  assert.ok(PRODUCTION_AUDIO_REQUIREMENTS.some((entry) => entry.assetId === 'sfx:battle-core'));
  assert.equal(PRODUCTION_UNIT_ART_CANDIDATES.length, 0, 'no production character art has been user-approved yet');
  assert.ok(PRODUCTION_VERTICAL_SLICE.length >= 8);
  assert.ok(PRODUCTION_VERTICAL_SLICE.every((entry) => entry.status !== 'APPROVED'));
});

test('unapproved production targets resolve to verified source-reference art without losing selected form identity', () => {
  const f3 = EVOLUTION_FORMS.find((form) => form.characterId === 'militia' && form.formOrder === 3);
  assert.ok(f3);
  const resolved = resolveUnitArt('militia', f3.formId);
  assert.equal(resolved.source, 'PLACEHOLDER');
  assert.equal(resolved.resolvedFormId, f3.formId);
  assert.match(resolved.family.idle.url, /^\/assets\/characters\//);

  const strips = getRuntimeSpriteStrips();
  const families = getRuntimeArtFamilies();
  assert.ok(strips.length >= families.length * 3, 'source-reference families preload core strips plus authored reaction strips when available');
  assert.ok(strips.every((strip) => strip.url.startsWith('/assets/characters/')));
});

test('militia evolution forms use distinct complete source-reference motion sets while raider stays separate', () => {
  const f1 = resolveUnitArt('militia', 'militia_f1');
  const f2 = resolveUnitArt('militia', 'militia_f2');
  const f3 = resolveUnitArt('militia', 'militia_f3');
  const raider = resolveUnitArt('enemy-raider');

  assert.deepEqual(
    [f1.family.id, f2.family.id, f3.family.id],
    ['warrior-3', 'hero-knight-2', 'warrior-1'],
    'militia F1/F2/F3 source references should read as recruit, regular infantry, and veteran progression',
  );
  assert.equal(new Set([f1.family.id, f2.family.id, f3.family.id]).size, 3);
  assert.equal(raider.family.id, 'warrior');
  assert.ok(!new Set([f1.family.id, f2.family.id, f3.family.id]).has(raider.family.id));
  assert.ok([f1, f2, f3, raider].every((art) => art.source === 'PLACEHOLDER'));

  const expectedReactionFrames = new Map([
    ['warrior-3', [3, 9]],
    ['hero-knight-2', [4, 9]],
    ['warrior-1', [3, 9]],
    ['warrior', [4, 6]],
  ] as const);
  for (const art of [f1, f2, f3, raider]) {
    assert.ok(art.family.knockback, `${art.family.id} must expose its authored hit strip`);
    assert.ok(art.family.death, `${art.family.id} must expose its authored death strip`);
    assert.deepEqual(
      [art.family.knockback.frames, art.family.death.frames],
      expectedReactionFrames.get(art.family.id),
      `${art.family.id} reaction frame metadata must stay aligned to the pinned source sheets`,
    );
  }
});

test('story magic evolutions use three distinct complete source-reference silhouettes without claiming production approval', () => {
  const progressions = [
    ['battlemage', ['wizard', 'fantasy-warrior', 'evil-wizard-2'], 'MAGIC'],
    ['pyromancer', ['wizard', 'evil-wizard', 'evil-wizard-2'], 'FIRE'],
    ['voidsage', ['evil-wizard', 'wizard', 'evil-wizard-2'], 'VOID'],
  ] as const;

  for (const [unitId, expectedFamilies, expectedFx] of progressions) {
    const forms = [1, 2, 3].map((order) => resolveUnitArt(unitId, `${unitId}_f${order}`));
    assert.deepEqual(forms.map((art) => art.family.id), expectedFamilies, `${unitId} F1/F2/F3 family progression drifted`);
    assert.equal(new Set(forms.map((art) => art.family.id)).size, 3, `${unitId} must read as three distinct evolution silhouettes`);
    assert.ok(forms.every((art) => art.source === 'PLACEHOLDER'));
    assert.ok(forms.every((art) => art.productionAssetId === undefined));
    assert.ok(forms.every((art) => art.attackFx === expectedFx));
    assert.ok(forms.every((art) => art.family.knockback && art.family.death));
  }
});

test('guard and lancer keep custom-silhouette debt explicit instead of faking F3 with unrelated free art', () => {
  const guardForms = [1, 2, 3].map((order) => resolveUnitArt('guard', `guard_f${order}`));
  const lancerForms = [1, 2, 3].map((order) => resolveUnitArt('lancer', `lancer_f${order}`));

  assert.deepEqual(guardForms.map((art) => art.family.id), ['hero-knight-2', 'hero-knight-2', 'hero-knight-2']);
  assert.deepEqual(lancerForms.map((art) => art.family.id), ['huntress', 'huntress', 'huntress']);
  assert.ok([...guardForms, ...lancerForms].every((art) => art.source === 'PLACEHOLDER'));
  assert.ok([...guardForms, ...lancerForms].every((art) => art.productionAssetId === undefined));
  assert.ok(guardForms.every((art) => art.family.knockback && art.family.death));
  assert.ok(lancerForms.every((art) => art.family.knockback && art.family.death));
});

test('active visual-form mirror drives the shared production resolver when no explicit form is supplied', () => {
  const f2 = EVOLUTION_FORMS.find((form) => form.characterId === 'militia' && form.formOrder === 2);
  assert.ok(f2);
  clearActiveVisualForms();
  syncActiveVisualForms({ militia: { selectedFormId: f2.formId } });

  const resolved = resolveUnitArt('militia');
  assert.equal(resolved.resolvedFormId, f2.formId);
  assert.equal(resolved.family.id, 'hero-knight-2');
  assert.equal(resolved.source, 'PLACEHOLDER');

  clearActiveVisualForms();
  const fallback = resolveUnitArt('militia');
  const f1 = EVOLUTION_FORMS.find((form) => form.characterId === 'militia' && form.formOrder === 1);
  assert.ok(f1);
  assert.equal(fallback.resolvedFormId, f1.formId);
  assert.equal(fallback.family.id, 'warrior-3');
});

test('active visual-form mirror tracks save-selected form ids without mutating progression', () => {
  clearActiveVisualForms();
  syncActiveVisualForms({
    militia: { selectedFormId: 'militia_f3' },
    guard: {},
  });
  assert.equal(getActiveVisualFormId('militia'), 'militia_f3');
  assert.equal(getActiveVisualFormId('guard'), undefined);
  clearActiveVisualForms();
  assert.equal(getActiveVisualFormId('militia'), undefined);
});
