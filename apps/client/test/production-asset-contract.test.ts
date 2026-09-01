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

test('unapproved production targets resolve to verified placeholder art without losing selected form identity', () => {
  const f3 = EVOLUTION_FORMS.find((form) => form.characterId === 'militia' && form.formOrder === 3);
  assert.ok(f3);
  const resolved = resolveUnitArt('militia', f3.formId);
  assert.equal(resolved.source, 'PLACEHOLDER');
  assert.equal(resolved.resolvedFormId, f3.formId);
  assert.match(resolved.family.idle.url, /^\/assets\/characters\//);

  const strips = getRuntimeSpriteStrips();
  assert.equal(strips.length, 21, 'with no approved production candidates only seven placeholder families preload');
  assert.ok(strips.every((strip) => strip.url.startsWith('/assets/characters/')));
});

test('active visual-form mirror drives the shared production resolver when no explicit form is supplied', () => {
  const f2 = EVOLUTION_FORMS.find((form) => form.characterId === 'militia' && form.formOrder === 2);
  assert.ok(f2);
  clearActiveVisualForms();
  syncActiveVisualForms({ militia: { selectedFormId: f2.formId } });

  const resolved = resolveUnitArt('militia');
  assert.equal(resolved.resolvedFormId, f2.formId);
  assert.equal(resolved.source, 'PLACEHOLDER');

  clearActiveVisualForms();
  const fallback = resolveUnitArt('militia');
  const f1 = EVOLUTION_FORMS.find((form) => form.characterId === 'militia' && form.formOrder === 1);
  assert.ok(f1);
  assert.equal(fallback.resolvedFormId, f1.formId);
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
