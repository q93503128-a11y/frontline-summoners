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

test('PC battle hotkeys map 1 through 0 to units, Q to supply upgrade, and E to the base weapon', async () => {
  const source = await readMain();
  assert.match(source, /'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'/);
  assert.match(source, /BATTLE_UNIT_HOTKEY_CODES\.indexOf\(event\.code\)/);
  assert.match(source, /event\.code === 'KeyQ'/);
  assert.match(source, /event\.code === 'KeyE'/);
  assert.match(source, /event\.code === 'KeyP' \|\| event\.code === 'Escape'/);
  assert.match(source, /Q · 보급소 강화/);
  assert.match(source, /E · 전선포 · 발사 가능/);
  assert.match(source, /getUnitHotkeyLabel\(index\)/);
});

test('mouse and keyboard battle actions share quiet failure paths without camera shake', async () => {
  const source = await readMain();
  assert.match(source, /bg\.on\('pointerdown', \(\) => this\.trySpawnSlot\(slot\.slotId\)\)/);
  assert.match(source, /upgradeBg\.on\('pointerdown', \(\) => this\.tryUpgradeSupplyInput\(\)\)/);
  assert.match(source, /this\.baseWeaponBg\.on\('pointerdown', \(\) => this\.tryFireBaseWeaponInput\(\)\)/);

  const actionStart = source.indexOf('private trySpawnSlot');
  const actionEnd = source.indexOf('private toggleManualPause');
  assert.ok(actionStart >= 0 && actionEnd > actionStart);
  const actionBlock = source.slice(actionStart, actionEnd);
  assert.match(actionBlock, /trySpawnPlayerUnit\(this\.state, slotId\);/);
  assert.match(actionBlock, /tryUpgradeSupply\(this\.state\);/);
  assert.match(actionBlock, /const result = tryFireBaseWeapon\(this\.state\);/);
  assert.match(actionBlock, /if \(result\.ok\) this\.playBaseWeaponFx\(\);/);
  assert.doesNotMatch(actionBlock, /cameras\.main\.shake/);
});

test('stage cards render the restored twelve-step difficulty scale without legacy five-star overflow', async () => {
  const source = await readMain();
  assert.match(source, /`난이도 \$\{stage\.difficulty\} \/ 12`/);
  assert.doesNotMatch(source, /const stars = '★'\.repeat/);
});
