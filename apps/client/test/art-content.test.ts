import assert from 'node:assert/strict';
import test from 'node:test';
import { ART_BY_ID, ART_FAMILIES, UNIT_ART } from '../src/assets.ts';
import { ENEMIES, PLAYER_SLOTS } from '../src/prototype.ts';

const allCombatantIds = [
  ...PLAYER_SLOTS.map((slot) => slot.definition.id),
  ...ENEMIES.map((enemy) => enemy.definition.id),
];

const ATTACK_FX_STYLES = new Set(['SLASH', 'PIERCE', 'BLUNT', 'MAGIC', 'FIRE', 'VOID']);

test('every chapter one player and enemy has a registered art family and attack FX style', () => {
  assert.equal(allCombatantIds.length, 20);
  for (const id of allCombatantIds) {
    const variant = UNIT_ART[id];
    assert.ok(variant, `missing UNIT_ART mapping for ${id}`);
    assert.ok(ART_BY_ID[variant.familyId], `unknown art family ${variant.familyId} for ${id}`);
    assert.ok(ATTACK_FX_STYLES.has(variant.attackFx), `unknown attack FX ${variant.attackFx} for ${id}`);
  }
});

test('all sprite strips are local deploy assets with coherent frame metadata', () => {
  assert.equal(ART_FAMILIES.length, 7);
  for (const family of ART_FAMILIES) {
    for (const strip of [family.idle, family.run, family.attack]) {
      assert.match(strip.url, /^\/assets\/characters\//, `${family.id} must not load a runtime remote URL`);
      assert.ok(strip.frameWidth > 0 && strip.frameHeight > 0 && strip.frames > 0);
    }
    assert.ok(Number.isInteger(family.attackContactFrame), `${family.id} contact frame must be an integer`);
    assert.ok(family.attackContactFrame >= 0 && family.attackContactFrame < family.attack.frames, `${family.id} contact frame must be inside its attack strip`);
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

test('chapter one exposes multiple readable attack languages', () => {
  const playerStyles = new Set(PLAYER_SLOTS.map((slot) => UNIT_ART[slot.definition.id]?.attackFx));
  assert.ok(playerStyles.has('SLASH'));
  assert.ok(playerStyles.has('PIERCE'));
  assert.ok(playerStyles.has('MAGIC'));
  assert.ok(playerStyles.has('FIRE'));
  assert.ok(playerStyles.has('VOID'));
  assert.ok(playerStyles.size >= 6, `expected six player attack FX styles, got ${playerStyles.size}`);
});
