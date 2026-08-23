import assert from 'node:assert/strict';
import test from 'node:test';
import { ART_BY_ID, ART_FAMILIES, UNIT_ART } from '../src/assets.ts';
import { ENEMIES, PLAYER_SLOTS } from '../src/prototype.ts';

const allCombatantIds = [
  ...PLAYER_SLOTS.map((slot) => slot.definition.id),
  ...ENEMIES.map((enemy) => enemy.definition.id),
];

test('every chapter one player and enemy has a registered art family', () => {
  assert.equal(allCombatantIds.length, 20);
  for (const id of allCombatantIds) {
    const variant = UNIT_ART[id];
    assert.ok(variant, `missing UNIT_ART mapping for ${id}`);
    assert.ok(ART_BY_ID[variant.familyId], `unknown art family ${variant.familyId} for ${id}`);
  }
});

test('all sprite strips are local deploy assets with coherent frame metadata', () => {
  assert.equal(ART_FAMILIES.length, 7);
  for (const family of ART_FAMILIES) {
    for (const strip of [family.idle, family.run, family.attack]) {
      assert.match(strip.url, /^\/assets\/characters\//, `${family.id} must not load a runtime remote URL`);
      assert.ok(strip.frameWidth > 0 && strip.frameHeight > 0 && strip.frames > 0);
    }
  }
  const hero = ART_BY_ID['hero-knight'];
  assert.ok(hero);
  assert.equal(hero.idle.frameWidth, 180);
  assert.equal(hero.idle.frames, 11);
});

test('chapter one avoids a single repeated visual family for all player units', () => {
  const families = new Set(PLAYER_SLOTS.map((slot) => UNIT_ART[slot.definition.id]?.familyId));
  assert.ok(families.size >= 7, `expected all seven baseline families across player roster, got ${families.size}`);
});
