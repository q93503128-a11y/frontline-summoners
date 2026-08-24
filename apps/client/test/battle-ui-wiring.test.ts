import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readMain(): Promise<string> {
  return readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
}

test('battle loop launches ranged visuals before deterministic damage step and then advances projectile views', async () => {
  const source = await readMain();
  const launchIndex = source.indexOf('this.syncProjectileLaunches();');
  const stepIndex = source.indexOf('stepPlayableBattle(this.state);');
  const renderIndex = source.indexOf('this.syncProjectileViews();');
  assert.ok(launchIndex >= 0);
  assert.ok(stepIndex > launchIndex);
  assert.ok(renderIndex > stepIndex);
});

test('travel projectiles replace caster-local hit FX instead of duplicating it on contact', async () => {
  const source = await readMain();
  assert.match(source, /impactMoment && !usesTravelProjectile\(art\.attackFx\)/);
  assert.match(source, /getProjectileTravelPlan\(art\.attackFx, firstHitFrame, Math\.abs\(endX - startX\)\)/);
  assert.match(source, /getProjectileArcOffsetY\(projectile\.style, progress\)/);
});

test('player specialties are visible in deck and enemy traits are visible in battle', async () => {
  const source = await readMain();
  assert.match(source, /formatCombatTraits\(slot\.definition\)/);
  assert.match(source, /formatDamageSpecialty\(slot\.definition\)/);
  assert.match(source, /formatCompactTraits\(unit\.definition\)/);
  assert.match(source, /unit\.team === 'ENEMY' && unit\.state !== UnitState\.Dying/);
});
