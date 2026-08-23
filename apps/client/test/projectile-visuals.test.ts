import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROJECTILE_VISUAL_TICK_MS,
  getProjectileArcOffsetY,
  getProjectileLaunchFrame,
  getProjectileTravelDurationMs,
  getProjectileTravelPlan,
  usesTravelProjectile,
} from '../src/projectile-visuals.ts';

test('melee effects remain immediate while ranged effects get deterministic travel plans', () => {
  assert.equal(usesTravelProjectile('SLASH'), false);
  assert.equal(usesTravelProjectile('BLUNT'), false);
  assert.equal(usesTravelProjectile('PIERCE'), true);
  assert.equal(usesTravelProjectile('MAGIC'), true);
  assert.equal(usesTravelProjectile('FIRE'), true);
  assert.equal(usesTravelProjectile('VOID'), true);

  assert.equal(getProjectileLaunchFrame('SLASH', 8), null);
  for (const [style, hitFrame] of [
    ['PIERCE', 14],
    ['MAGIC', 19],
    ['FIRE', 27],
    ['VOID', 34],
  ] as const) {
    const plan = getProjectileTravelPlan(style, hitFrame, 360);
    assert.ok(plan);
    assert.equal(plan.launchFrame + plan.travelTicks, hitFrame);
    assert.equal(plan.durationMs, plan.travelTicks * PROJECTILE_VISUAL_TICK_MS);
    assert.ok(plan.launchFrame >= 0);
  }
});

test('farther projectile targets launch no later than nearer targets and still arrive on hit frame', () => {
  const near = getProjectileTravelPlan('MAGIC', 19, 40);
  const far = getProjectileTravelPlan('MAGIC', 19, 360);
  assert.ok(near && far);
  assert.ok(far.travelTicks >= near.travelTicks);
  assert.ok(far.launchFrame <= near.launchFrame);
  assert.equal(near.launchFrame + near.travelTicks, 19);
  assert.equal(far.launchFrame + far.travelTicks, 19);

  const desiredNear = getProjectileTravelDurationMs('MAGIC', 40);
  const desiredFar = getProjectileTravelDurationMs('MAGIC', 360);
  const desiredBeyond = getProjectileTravelDurationMs('MAGIC', 1000);
  assert.ok(desiredNear >= 105);
  assert.ok(desiredFar > desiredNear);
  assert.equal(desiredBeyond, desiredFar);
});

test('projectile arc starts and ends on target height', () => {
  assert.equal(getProjectileArcOffsetY('FIRE', 0), 0);
  assert.equal(getProjectileArcOffsetY('FIRE', 1), 0);
  assert.ok(getProjectileArcOffsetY('FIRE', 0.5) < 0);
  assert.equal(getProjectileArcOffsetY('PIERCE', 0.5), 0);
});
