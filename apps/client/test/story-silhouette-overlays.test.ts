import assert from 'node:assert/strict';
import test from 'node:test';
import { getStorySilhouetteOverlaySpec } from '../src/story-silhouette-overlays.ts';

test('guard placeholder overlay grows from field shield into moving wall without claiming another unit silhouette', () => {
  const f1 = getStorySilhouetteOverlaySpec('guard', 'guard_f1');
  const f2 = getStorySilhouetteOverlaySpec('guard', 'guard_f2');
  const f3 = getStorySilhouetteOverlaySpec('guard', 'guard_f3');

  assert.ok(f1 && f1.kind === 'GUARD_SHIELD');
  assert.ok(f2 && f2.kind === 'GUARD_SHIELD');
  assert.ok(f3 && f3.kind === 'GUARD_SHIELD');
  assert.equal(new Set([f1.key, f2.key, f3.key]).size, 3);
  assert.ok(f1.shieldWidth < f2.shieldWidth && f2.shieldWidth < f3.shieldWidth);
  assert.ok(f1.shieldHeight < f2.shieldHeight && f2.shieldHeight < f3.shieldHeight);
  assert.equal(f1.battlementCount, 0);
  assert.ok(f2.battlementCount > 0);
  assert.ok(f3.battlementCount > f2.battlementCount);
  assert.equal(f1.skidWidth, 0);
  assert.equal(f2.skidWidth, 0);
  assert.ok(f3.skidWidth > 0);
  assert.ok(f3.wheelRadius > 0);
});

test('lancer placeholder overlay keeps F2 as the longest formation pike and F3 as the broadest sweeping blade', () => {
  const f1 = getStorySilhouetteOverlaySpec('lancer', 'lancer_f1');
  const f2 = getStorySilhouetteOverlaySpec('lancer', 'lancer_f2');
  const f3 = getStorySilhouetteOverlaySpec('lancer', 'lancer_f3');

  assert.ok(f1 && f1.kind === 'LANCER_SPEAR');
  assert.ok(f2 && f2.kind === 'LANCER_SPEAR');
  assert.ok(f3 && f3.kind === 'LANCER_SPEAR');
  assert.equal(new Set([f1.key, f2.key, f3.key]).size, 3);
  assert.ok(f2.shaftForward > f1.shaftForward);
  assert.ok(f2.shaftForward > f3.shaftForward);
  assert.ok(f2.rearExtent > f1.rearExtent);
  assert.ok(f3.bladeLength > f1.bladeLength && f3.bladeLength > f2.bladeLength);
  assert.ok(f3.bladeHalfHeight > f1.bladeHalfHeight && f3.bladeHalfHeight > f2.bladeHalfHeight);
});

test('story silhouette overlays are narrowly scoped to the canonical guard and lancer runtime ids', () => {
  assert.equal(getStorySilhouetteOverlaySpec('militia', 'militia_f3'), undefined);
  assert.equal(getStorySilhouetteOverlaySpec('blue_lancer', 'blue_lancer_f3'), undefined);
  assert.equal(getStorySilhouetteOverlaySpec('guard', 'lancer_f3'), undefined);
  assert.equal(getStorySilhouetteOverlaySpec('lancer', 'guard_f3'), undefined);
  assert.equal(getStorySilhouetteOverlaySpec('guard'), undefined);
});
