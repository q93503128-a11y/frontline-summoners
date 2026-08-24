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

test('travel projectiles replace caster-local hit FX and interpolate render position between 30Hz ticks', async () => {
  const source = await readMain();
  assert.match(source, /impactMoment && !usesTravelProjectile\(art\.attackFx\)/);
  assert.match(source, /getProjectileTravelPlan\(art\.attackFx, firstHitFrame, Math\.abs\(endX - startX\)\)/);
  assert.match(source, /const fractionalTick = Math\.max\(0, Math\.min\(1, this\.accumulator \/ SIM_TICK_MS\)\);/);
  assert.match(source, /const renderTick = this\.state\.battle\.tick \+ fractionalTick;/);
  assert.match(source, /\(renderTick - projectile\.startTick\) \/ span/);
  assert.match(source, /getProjectileArcOffsetY\(projectile\.style, progress\)/);
});

test('saved guaranteed treasures are passed into the actual browser battle config', async () => {
  const source = await readMain();
  assert.match(
    source,
    /createPrototypeBattle\(this\.stage\.id, this\.activeSlots\.map\(\(slot\) => slot\.slotId\), progress\.treasureIds\)/,
  );
});

test('player specialties are visible in deck and enemy traits are visible in battle', async () => {
  const source = await readMain();
  assert.match(source, /formatCombatTraits\(slot\.definition\)/);
  assert.match(source, /formatDamageSpecialty\(slot\.definition\)/);
  assert.match(source, /formatCompactTraits\(unit\.definition\)/);
  assert.match(source, /unit\.team === 'ENEMY' && unit\.state !== UnitState\.Dying/);
});
