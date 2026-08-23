import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getProjectileArcOffsetY,
  getProjectileLaunchFrame,
  getProjectileTravelDurationMs,
  usesTravelProjectile,
} from '../src/projectile-visuals.ts';

test('melee effects remain immediate while ranged effects get deterministic launch lead', () => {
  assert.equal(usesTravelProjectile('SLASH'), false);
  assert.equal(usesTravelProjectile('BLUNT'), false);
  assert.equal(usesTravelProjectile('PIERCE'), true);
  assert.equal(usesTravelProjectile('MAGIC'), true);
  assert.equal(usesTravelProjectile('FIRE'), true);
  assert.equal(usesTravelProjectile('VOID'), true);

  assert.equal(getProjectileLaunchFrame('PIERCE', 14), 12);
  assert.equal(getProjectileLaunchFrame('MAGIC', 19), 15);
  assert.equal(getProjectileLaunchFrame('FIRE', 27), 22);
  assert.equal(getProjectileLaunchFrame('VOID', 34), 28);
  assert.equal(getProjectileLaunchFrame('SLASH', 8), null);
});

test('projectile duration is bounded and grows with visual distance', () => {
  const near = getProjectileTravelDurationMs('MAGIC', 40);
  const far = getProjectileTravelDurationMs('MAGIC', 360);
  const beyond = getProjectileTravelDurationMs('MAGIC', 1000);
  assert.ok(near >= 105);
  assert.ok(far > near);
  assert.equal(beyond, far);
});

test('projectile arc starts and ends on target height', () => {
  assert.equal(getProjectileArcOffsetY('FIRE', 0), 0);
  assert.equal(getProjectileArcOffsetY('FIRE', 1), 0);
  assert.ok(getProjectileArcOffsetY('FIRE', 0.5) < 0);
  assert.equal(getProjectileArcOffsetY('PIERCE', 0.5), 0);
});
