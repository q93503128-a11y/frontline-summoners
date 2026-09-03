import assert from 'node:assert/strict';
import test from 'node:test';
import { getStorySilhouetteOverlaySpec } from '../src/story-silhouette-overlays.ts';

function forms(unitId: string): readonly [any, any, any] {
  return [1, 2, 3].map((order) => getStorySilhouetteOverlaySpec(unitId, `${unitId}_f${order}`)) as [any, any, any];
}

test('guard grows from field shield into moving wall', () => {
  const [f1, f2, f3] = forms('guard');
  assert.equal(f1.kind, 'GUARD_SHIELD'); assert.equal(f2.kind, 'GUARD_SHIELD'); assert.equal(f3.kind, 'GUARD_SHIELD');
  assert.ok(f1.shieldWidth < f2.shieldWidth && f2.shieldWidth < f3.shieldWidth);
  assert.ok(f3.battlementCount > f2.battlementCount);
  assert.ok(f3.skidWidth > 0 && f3.wheelRadius > 0);
});

test('hunter progresses from plain hunting spear to hooked trophy weapon and longest royal pike', () => {
  const [f1, f2, f3] = forms('hunter');
  assert.equal(f1.kind, 'HUNTER_POLEARM'); assert.equal(f2.kind, 'HUNTER_POLEARM'); assert.equal(f3.kind, 'HUNTER_POLEARM');
  assert.equal(f1.hookDepth, 0);
  assert.ok(f2.hookDepth > f1.hookDepth && f2.trophyCount > f1.trophyCount);
  assert.ok(f3.shaftForward > f2.shaftForward && f3.bannerDrop > 0);
});

test('duelist makes F2 the rotating dual-weapon form and F3 the longest restrained single blade', () => {
  const [f1, f2, f3] = forms('duelist');
  assert.equal(f1.kind, 'DUELIST_BLADE'); assert.equal(f2.kind, 'DUELIST_BLADE'); assert.equal(f3.kind, 'DUELIST_BLADE');
  assert.equal(f1.offhandDaggerLength, 0);
  assert.ok(f2.offhandDaggerLength > 0 && f2.coatTailLength > f1.coatTailLength);
  assert.ok(f3.bladeLength > f1.bladeLength && f3.bladeLength > f2.bladeLength);
  assert.ok(f3.scabbardLength > 0 && f3.offhandDaggerLength === 0);
});

test('lancer keeps F2 as the longest formation pike and F3 as the broadest sweeping blade', () => {
  const [f1, f2, f3] = forms('lancer');
  assert.equal(f1.kind, 'LANCER_SPEAR'); assert.equal(f2.kind, 'LANCER_SPEAR'); assert.equal(f3.kind, 'LANCER_SPEAR');
  assert.ok(f2.shaftForward > f1.shaftForward && f2.shaftForward > f3.shaftForward);
  assert.ok(f3.bladeLength > f1.bladeLength && f3.bladeHalfHeight > f2.bladeHalfHeight);
});

test('battlemage grows tactical board count and reserves the largest folding artillery frame for F3', () => {
  const [f1, f2, f3] = forms('battlemage');
  assert.equal(f1.kind, 'ARCANE_FRAME'); assert.equal(f2.kind, 'ARCANE_FRAME'); assert.equal(f3.kind, 'ARCANE_FRAME');
  assert.ok(f1.plateCount < f2.plateCount && f2.plateCount < f3.plateCount);
  assert.ok(f1.frameRadius < f2.frameRadius && f2.frameRadius < f3.frameRadius);
  assert.ok(f3.staffLength < f1.staffLength);
});

test('pyromancer reads as carried furnace, broad hearth, then floating calamity furnace ring', () => {
  const [f1, f2, f3] = forms('pyromancer');
  assert.equal(f1.kind, 'FURNACE'); assert.equal(f2.kind, 'FURNACE'); assert.equal(f3.kind, 'FURNACE');
  assert.ok(f2.furnaceWidth > f1.furnaceWidth);
  assert.equal(f1.ringRadius, 0); assert.equal(f2.ringRadius, 0);
  assert.ok(f3.ringRadius > 0 && f3.floating && f3.crackCount > f2.crackCount);
});

test('royal knight makes F2 the heaviest guard form and F3 the longest thinnest attack blade', () => {
  const [f1, f2, f3] = forms('royal');
  assert.equal(f1.kind, 'GREATBLADE'); assert.equal(f2.kind, 'GREATBLADE'); assert.equal(f3.kind, 'GREATBLADE');
  assert.ok(f2.bladeWidth > f1.bladeWidth && f2.guardWidth > f1.guardWidth);
  assert.ok(f3.bladeLength > f2.bladeLength && f3.bladeWidth < f1.bladeWidth);
});

test('heretic gives F2 the large ritual ring while F3 removes it for split close-range tools', () => {
  const [f1, f2, f3] = forms('heretic');
  assert.equal(f1.kind, 'RITUAL'); assert.equal(f2.kind, 'RITUAL'); assert.equal(f3.kind, 'RITUAL');
  assert.equal(f1.ringRadius, 0);
  assert.ok(f2.ringRadius > 0 && f2.talismanCount > f1.talismanCount);
  assert.equal(f3.ringRadius, 0); assert.equal(f3.splitTools, true); assert.ok(f3.toolLength < f1.toolLength);
});

test('void sage grows from three orbit shards into the largest seven-shard space fracture', () => {
  const [f1, f2, f3] = forms('voidsage');
  assert.equal(f1.kind, 'VOID_ORBIT'); assert.equal(f2.kind, 'VOID_ORBIT'); assert.equal(f3.kind, 'VOID_ORBIT');
  assert.deepEqual([f1.shardCount, f2.shardCount, f3.shardCount], [3, 5, 7]);
  assert.ok(f1.radiusX < f2.radiusX && f2.radiusX < f3.radiusX);
  assert.ok(f1.shardLength < f2.shardLength && f2.shardLength < f3.shardLength);
});

test('story silhouette overlays stay scoped to canonical runtime ids and matching form ids', () => {
  assert.equal(getStorySilhouetteOverlaySpec('militia', 'militia_f3'), undefined);
  assert.equal(getStorySilhouetteOverlaySpec('blue_lancer', 'lancer_f3'), undefined);
  assert.equal(getStorySilhouetteOverlaySpec('guard', 'lancer_f3'), undefined);
  assert.equal(getStorySilhouetteOverlaySpec('hunter', 'guard_f3'), undefined);
  assert.equal(getStorySilhouetteOverlaySpec('guard'), undefined);
});
