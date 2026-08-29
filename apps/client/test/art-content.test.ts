import assert from 'node:assert/strict';
import test from 'node:test';
import { ART_BY_ID, ART_FAMILIES, UNIT_ART } from '../src/assets.ts';
import { ENEMIES, PLAYER_SLOTS, RECRUITMENT_PLAYER_SLOTS } from '../src/prototype.ts';

const implementedStoryAndEnemyIds = [
  ...PLAYER_SLOTS.map((slot) => slot.definition.id),
  ...ENEMIES.map((enemy) => enemy.definition.id),
];

const ATTACK_FX_STYLES = new Set(['SLASH', 'PIERCE', 'BLUNT', 'MAGIC', 'FIRE', 'VOID']);

test('every implemented story player and enemy has a registered art family and attack FX style', () => {
  assert.equal(PLAYER_SLOTS.length, 10);
  assert.equal(ENEMIES.length, 46, 'four main chapters plus the permanent SPECIAL execution roster expose forty-six enemy definitions');
  assert.equal(implementedStoryAndEnemyIds.length, 56);
  for (const id of implementedStoryAndEnemyIds) {
    const variant = UNIT_ART[id];
    assert.ok(variant, `missing UNIT_ART mapping for ${id}`);
    assert.ok(ART_BY_ID[variant.familyId], `unknown art family ${variant.familyId} for ${id}`);
    assert.ok(ATTACK_FX_STYLES.has(variant.attackFx), `unknown attack FX ${variant.attackFx} for ${id}`);
  }
});

test('all thirty-three recruitment characters have explicit temporary art mappings', () => {
  assert.equal(RECRUITMENT_PLAYER_SLOTS.length, 33);
  for (const slot of RECRUITMENT_PLAYER_SLOTS) {
    const id = slot.definition.id;
    const variant = UNIT_ART[id];
    assert.ok(variant, `missing recruitment UNIT_ART mapping for ${id}`);
    assert.ok(ART_BY_ID[variant.familyId], `unknown art family ${variant.familyId} for ${id}`);
    assert.ok(ATTACK_FX_STYLES.has(variant.attackFx), `unknown attack FX ${variant.attackFx} for ${id}`);
  }
  assert.ok(
    new Set(RECRUITMENT_PLAYER_SLOTS.map((slot) => UNIT_ART[slot.definition.id]?.familyId)).size >= 7,
    'the structural recruitment slice should exercise every baseline visual family until production character art replaces it',
  );
});

test('canonical recruitment ids no longer fall back to legacy prototype ids', () => {
  const ids = new Set(RECRUITMENT_PLAYER_SLOTS.map((slot) => slot.slotId));
  assert.ok(ids.has('char_common_c_turnip_rider'));
  assert.ok(ids.has('char_s01_arselia'));
  assert.ok(ids.has('char_s02_gormu'));
  assert.ok(ids.has('char_s03_overlay_astra'));
  for (const legacyId of ['turnip-rider', 'clockwork-duck', 'mirror-exorcist', 'moon-eater', 'castle-crab']) {
    assert.equal(ids.has(legacyId), false, `legacy recruitment id remained executable: ${legacyId}`);
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
