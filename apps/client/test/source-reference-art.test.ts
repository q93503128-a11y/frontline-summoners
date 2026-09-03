import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveUnitArt } from '../src/production-assets.ts';
import { SOURCE_REFERENCE_ART_BY_ID } from '../src/source-reference-art.ts';

test('first-slice source-reference families expose authored hit and death strips', () => {
  const expected = new Map([
    ['warrior-3', { hit: 3, death: 9 }],
    ['hero-knight-2', { hit: 4, death: 9 }],
    ['warrior-1', { hit: 3, death: 9 }],
    ['warrior', { hit: 4, death: 6 }],
    ['evil-wizard', { hit: 4, death: 5 }],
  ] as const);

  for (const [familyId, frames] of expected) {
    const family = SOURCE_REFERENCE_ART_BY_ID[familyId];
    assert.ok(family, `missing source-reference family: ${familyId}`);
    assert.ok(family.knockback, `${familyId} must expose authored hit motion`);
    assert.ok(family.death, `${familyId} must expose authored death motion`);
    assert.equal(family.knockback.frames, frames.hit);
    assert.equal(family.death.frames, frames.death);
    assert.match(family.knockback.url, /^\/assets\/characters\//);
    assert.match(family.death.url, /^\/assets\/characters\//);
  }
});

test('golden-mask boss reservation remains placeholder while using complete Evil Wizard source motion', () => {
  const boss = resolveUnitArt('enemy-boss');
  assert.equal(boss.source, 'PLACEHOLDER');
  assert.equal(boss.productionAssetId, undefined);
  assert.equal(boss.family.id, 'evil-wizard');
  assert.ok(boss.family.knockback);
  assert.ok(boss.family.death);
});
