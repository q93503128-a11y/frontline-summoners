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

test('PC battle hotkeys map 1 through 0 to current deck slots, Q to supply upgrade, and E to the base weapon', async () => {
  const source = await readMain();
  assert.match(source, /'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'/);
  assert.match(source, /BATTLE_UNIT_HOTKEY_CODES\.indexOf\(event\.code\)/);
  assert.match(source, /const slot = this\.activeSlots\[slotIndex\];/);
  assert.doesNotMatch(source, /const slot = PLAYER_SLOTS\[slotIndex\];/);
  assert.match(source, /event\.code === 'KeyQ'/);
  assert.match(source, /event\.code === 'KeyE'/);
  assert.match(source, /event\.code === 'KeyP' \|\| event\.code === 'Escape'/);
  assert.match(source, /compact \? '보급소 강화' : 'Q · 보급소 강화'/);
  assert.match(source, /const weaponPrefix = isCompactMobileViewport\(\) \? '전선포' : 'E · 전선포'/);
  assert.match(source, /if \(!compact\) addText\(this, x \+ 82, y - 25, hotkeyLabel/);
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

test('locked-stage and save-pending clicks are quiet; camera shake is reserved for exactly three combat impact paths', async () => {
  const source = await readMain();
  const stageStart = source.indexOf('class StageSelectScene');
  const deckStart = source.indexOf('class DeckScene');
  const resultStart = source.indexOf('class ResultScene');
  const gameStart = source.indexOf('new Phaser.Game');
  assert.ok(stageStart >= 0 && deckStart > stageStart && resultStart > deckStart && gameStart > resultStart);

  const stageBlock = source.slice(stageStart, deckStart);
  const resultBlock = source.slice(resultStart, gameStart);
  assert.match(stageBlock, /if \(unlocked\) this\.scene\.start\('battle', \{ stageId: stage\.id \}\);/);
  assert.doesNotMatch(stageBlock, /cameras\.main\.shake/);
  assert.match(resultBlock, /if \(!this\.progressionSaved\) return;/);
  assert.doesNotMatch(resultBlock, /cameras\.main\.shake/);

  const shakeCalls = source.match(/cameras\.main\.shake\(/g) ?? [];
  assert.equal(shakeCalls.length, 3, 'camera shake must stay limited to base weapon success, heavy unit impact, and base impact');
  assert.match(source, /private playBaseWeaponFx\(\): void[\s\S]*?cameras\.main\.shake/);
  assert.match(source, /private playUnitImpactFx[\s\S]*?cameras\.main\.shake/);
  assert.match(source, /private playBaseImpactFx[\s\S]*?cameras\.main\.shake/);
});

test('compact mobile battle HUD prioritizes readable touch controls without changing desktop shortcuts', async () => {
  const source = await readMain();
  assert.match(source, /function isCompactMobileViewport\(\): boolean/);
  assert.match(source, /Math\.min\(window\.innerWidth, window\.innerHeight\) <= 540/);
  assert.match(source, /function battleUiFontSize\(regular: number, compact: number\): number/);
  assert.match(source, /const compact = isCompactMobileViewport\(\);/);
  assert.match(source, /const buttonHeight = compact \? 80 : 62;/);
  assert.match(source, /const y = compact \? 582 \+ row \* 80 : 579 \+ row \* 72;/);
  assert.match(source, /const controlHeight = compact \? 76 : 60;/);
  assert.match(source, /const unitButtonName = compact \? slot\.displayName : `\$\{slot\.rarity\} · \$\{slot\.displayName\}`/);
  assert.match(source, /battleUiFontSize\(15, 22\)/);
  assert.match(source, /battleUiFontSize\(21, 28\)/);
  assert.match(source, /compact \? '전선포 · 발사 가능' : 'E · 전선포 · 발사 가능'/);
  assert.match(source, /width: INTERNAL_WIDTH/);
  assert.match(source, /height: INTERNAL_HEIGHT/);
});

test('compact two-row summon and right-side control hitboxes stay inside the bottom HUD without overlap', async () => {
  const source = await readMain();
  assert.match(source, /const x = 102 \+ col \* 205;/);
  assert.match(source, /const y = compact \? 582 \+ row \* 80 : 579 \+ row \* 72;/);
  assert.match(source, /this\.add\.rectangle\(x, y, 188, buttonHeight/);
  assert.match(source, /this\.add\.rectangle\(1145, upgradeY, 220, controlHeight/);
  assert.match(source, /this\.add\.rectangle\(1145, weaponY, 220, controlHeight/);

  const hudTop = 540;
  const hudBottom = 720;
  const unitHeight = 80;
  const unitRows = [582, 662];
  const controlHeight = 76;
  const controlRows = [582, 662];
  for (const center of unitRows) {
    assert.ok(center - unitHeight / 2 >= hudTop);
    assert.ok(center + unitHeight / 2 <= hudBottom);
  }
  for (const center of controlRows) {
    assert.ok(center - controlHeight / 2 >= hudTop);
    assert.ok(center + controlHeight / 2 <= hudBottom);
  }

  const lastUnitCenter = 102 + 4 * 205;
  const lastUnitRight = lastUnitCenter + 188 / 2;
  const controlLeft = 1145 - 220 / 2;
  assert.ok(lastUnitRight < controlLeft, `expected horizontal gap, got last unit right ${lastUnitRight} and control left ${controlLeft}`);
});

test('stage and deck cards keep desktop detail while compact mobile renders a reduced high-priority information set', async () => {
  const source = await readMain();
  const stageStart = source.indexOf('class StageSelectScene');
  const deckStart = source.indexOf('class DeckScene');
  const battleStart = source.indexOf('class BattleScene');
  assert.ok(stageStart >= 0 && deckStart > stageStart && battleStart > deckStart);
  const stageBlock = source.slice(stageStart, deckStart);
  const deckBlock = source.slice(deckStart, battleStart);

  assert.match(stageBlock, /const compact = isCompactMobileViewport\(\);/);
  assert.match(stageBlock, /if \(compact\) \{/);
  assert.match(stageBlock, /compact \? 28 : 25/);
  assert.match(stageBlock, /compact \? 535 : 548/);
  assert.match(stageBlock, /BATTLEFIELD_THEME_LABELS\[stage\.theme\]/, 'desktop stage detail must keep battlefield theme');
  assert.match(stageBlock, /`전장 \$\{stage\.mapLength\}m`/, 'desktop stage detail must keep map length');
  assert.match(stageBlock, /stage\.subtitle/, 'desktop stage detail must keep subtitle');

  assert.match(deckBlock, /const compact = isCompactMobileViewport\(\);/);
  assert.match(deckBlock, /compact \? 27 : 22/);
  assert.match(deckBlock, /if \(!compact\) this\.cardsLayer!\.add\(addText\(this, x, y \+ \(specialty \? 103 : 84\), slot\.description/);
  assert.match(deckBlock, /slot\.description/, 'desktop deck card must retain the character description');
  assert.match(deckBlock, /compact \? '보유 동료 · 현재는 자동 편성' : '처음에는 징집병 1종만 보유한다\./);
});

test('stage cards render the restored twelve-step difficulty scale without legacy five-star overflow', async () => {
  const source = await readMain();
  assert.match(source, /`난이도 \$\{stage\.difficulty\} \/ 12`/);
  assert.doesNotMatch(source, /const stars = '★'\.repeat/);
});
