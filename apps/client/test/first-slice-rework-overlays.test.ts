import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FIRST_SLICE_REWORK_TARGET_KEYS,
  getFirstSliceReworkOverlaySpec,
} from '../src/first-slice-rework-overlays.ts';

test('first production slice rework covers militia F1-F3 and raider only', () => {
  assert.deepEqual(FIRST_SLICE_REWORK_TARGET_KEYS, [
    'unit:militia:militia_f1',
    'unit:militia:militia_f2',
    'unit:militia:militia_f3',
    'unit:enemy-raider',
  ]);

  const f1 = getFirstSliceReworkOverlaySpec('militia', 'militia_f1');
  const f2 = getFirstSliceReworkOverlaySpec('militia', 'militia_f2');
  const f3 = getFirstSliceReworkOverlaySpec('militia', 'militia_f3');
  const raider = getFirstSliceReworkOverlaySpec('enemy-raider');
  assert.ok(f1 && f2 && f3 && raider);
  assert.equal(new Set([f1.key, f2.key, f3.key, raider.key]).size, 4);
  assert.equal(f1.formOrder, 1);
  assert.equal(f2.formOrder, 2);
  assert.equal(f3.formOrder, 3);
  assert.equal(raider.kind, 'RAIDER');
});

test('militia forms encode the canonical silhouette progression rather than tint-only growth', () => {
  const f1 = getFirstSliceReworkOverlaySpec('militia', 'militia_f1')!;
  const f2 = getFirstSliceReworkOverlaySpec('militia', 'militia_f2')!;
  const f3 = getFirstSliceReworkOverlaySpec('militia', 'militia_f3')!;

  assert.ok(f2.packWidth > f1.packWidth, 'F2 should have the most orderly/full rectangular pack');
  assert.ok(f2.weaponLength > f1.weaponLength, 'F2 regular spear should extend beyond F1 improvised weapon');
  assert.ok(f3.weaponLength < f1.weaponLength, 'F3 must return to the shortest practical veteran weapon');
  assert.ok(f3.stanceDrop > f2.stanceDrop, 'F3 must read lower and more aggressive than F2');
  assert.ok(f3.wearMarks > f1.wearMarks && f3.wearMarks > f2.wearMarks, 'F3 veteran identity comes from worn gear');
});

test('raider keeps loot mass dominant and rejects fake form ids', () => {
  const raider = getFirstSliceReworkOverlaySpec('enemy-raider')!;
  assert.ok(raider.packWidth > raider.weaponLength, 'raider loot sack must read before the hand weapon');
  assert.ok(raider.packHeight > raider.weaponLength);
  assert.equal(getFirstSliceReworkOverlaySpec('enemy-raider', 'enemy-raider_f1'), undefined);
  assert.equal(getFirstSliceReworkOverlaySpec('militia'), undefined);
  assert.equal(getFirstSliceReworkOverlaySpec('militia', 'militia_f4'), undefined);
  assert.equal(getFirstSliceReworkOverlaySpec('enemy-boss'), undefined);
});
