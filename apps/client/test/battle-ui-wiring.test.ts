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
  assert.match(source, /const buttonHeight = compact \? 84 : 62;/);
  assert.match(source, /const y = compact \? 582 \+ row \* 84 : 579 \+ row \* 72;/);
  assert.match(source, /const controlHeight = compact \? 84 : 60;/);
  assert.match(source, /const weaponY = compact \? 666 : 651;/);
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
  assert.match(source, /const y = compact \? 582 \+ row \* 84 : 579 \+ row \* 72;/);
  assert.match(source, /this\.add\.rectangle\(x, y, 188, buttonHeight/);
  assert.match(source, /this\.add\.rectangle\(1145, upgradeY, 220, controlHeight/);
  assert.match(source, /this\.add\.rectangle\(1145, weaponY, 220, controlHeight/);

  const hudTop = 540;
  const hudBottom = 720;
  const unitHeight = 84;
  const unitRows = [582, 666];
  const controlHeight = 84;
  const controlRows = [582, 666];
  for (const center of unitRows) {
    assert.ok(center - unitHeight / 2 >= hudTop);
    assert.ok(center + unitHeight / 2 <= hudBottom);
  }
  for (const center of controlRows) {
    assert.ok(center - controlHeight / 2 >= hudTop);
    assert.ok(center + controlHeight / 2 <= hudBottom);
  }
  assert.equal(unitRows[1]! - unitRows[0]!, unitHeight, 'compact summon rows must meet without overlapping');
  assert.equal(controlRows[1]! - controlRows[0]!, controlHeight, 'compact right-side controls must meet without overlapping');

  const lastUnitCenter = 102 + 4 * 205;
  const lastUnitRight = lastUnitCenter + 188 / 2;
  const controlLeft = 1145 - 220 / 2;
  assert.ok(lastUnitRight < controlLeft, `expected horizontal gap, got last unit right ${lastUnitRight} and control left ${controlLeft}`);

  const scaleAt390High = 390 / 720;
  assert.ok(unitHeight * scaleAt390High >= 44, 'compact battle targets must stay finger-sized on a 390px-high landscape phone');
});

test('compact navigation buttons stay finger-sized across stage, deck, battle pause, and result screens', async () => {
  const source = await readMain();
  const stageStart = source.indexOf('class StageSelectScene');
  const deckStart = source.indexOf('class DeckScene');
  const battleStart = source.indexOf('class BattleScene');
  const resultStart = source.indexOf('class ResultScene');
  assert.ok(stageStart >= 0 && deckStart > stageStart && battleStart > deckStart && resultStart > battleStart);

  const stageBlock = source.slice(stageStart, deckStart);
  const deckBlock = source.slice(deckStart, battleStart);
  const battleBlock = source.slice(battleStart, resultStart);
  assert.match(stageBlock, /compact \? 84 : 50/);
  assert.match(stageBlock, /compact \? 84 : 52/);
  assert.match(stageBlock, /compact \? 84 : 52, unlocked/);
  assert.match(deckBlock, /compact \? 84 : 50/);
  assert.match(battleBlock, /compact \? 84 : 42, '일시정지'/);
  assert.match(battleBlock, /isCompactMobileViewport\(\) \? 84 : 58, '계 속'/);

  const scaleAt390High = 390 / 720;
  assert.ok(84 * scaleAt390High >= 44);
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
  assert.match(deckBlock, /compact \? 132 : 152/, 'compact portrait height must leave row separation while desktop keeps full portrait size');
  assert.match(deckBlock, /if \(!compact\) this\.cardsLayer!\.add\(addText\(this, x, y \+ \(specialty \? 103 : 84\), slot\.description/);
  assert.match(deckBlock, /slot\.description/, 'desktop deck card must retain the character description');
  assert.match(deckBlock, /compact \? '보유 동료 · 현재는 자동 편성' : '처음에는 징집병 1종만 보유한다\./);
  assert.match(deckBlock, /compact \? y \+ 62 : y \+ 46/, 'compact locked-card requirement spacing must stay at the audited position');

  const maxCompactPortraitHeight = 132 * 1.12;
  const secondRowPortraitTop = 540 - 63 - maxCompactPortraitHeight / 2;
  const firstRowCardBottom = 280 + 244 / 2;
  assert.ok(secondRowPortraitTop > firstRowCardBottom, `compact portrait rows must not overlap: ${secondRowPortraitTop} <= ${firstRowCardBottom}`);
});

test('main and result scenes use separate compact layouts while desktop keeps the full wording', async () => {
  const source = await readMain();
  const mainStart = source.indexOf('class MainMenuScene');
  const stageStart = source.indexOf('class StageSelectScene');
  const resultStart = source.indexOf('class ResultScene');
  const gameStart = source.indexOf('new Phaser.Game');
  assert.ok(mainStart >= 0 && stageStart > mainStart && resultStart > stageStart && gameStart > resultStart);

  const mainBlock = source.slice(mainStart, stageStart);
  const resultBlock = source.slice(resultStart, gameStart);
  assert.match(mainBlock, /const compact = isCompactMobileViewport\(\);/);
  assert.match(mainBlock, /const menuButtonHeight = compact \? 108 : 92;/);
  assert.match(mainBlock, /compact \? '승리할수록 전선과 동료가 열린다\.' : '첫 출정은 징집병 하나\. 승리할수록 전선과 동료가 열린다\.'/);
  assert.match(mainBlock, /if \(!compact\) addText\(this, 1185, 675, 'PRE-ALPHA'/);
  assert.match(mainBlock, /`클리어 \$\{progress\.clearedStageIds\.length\}\/\$\{STAGES\.length\} · 보물 \$\{progress\.treasureIds\.length\}\/\$\{STAGES\.length\} · 동료 \$\{unlocked\}\/\$\{PLAYER_SLOTS\.length\}`/);

  assert.match(resultBlock, /const compact = isCompactMobileViewport\(\);/);
  assert.match(resultBlock, /compact \? 820 : 760/);
  assert.match(resultBlock, /setWordWrapWidth\(compact \? 720 : 680\)/);
  assert.match(resultBlock, /const resultButtonHeight = compact \? 84 : 68;/);
  assert.match(resultBlock, /compact \? '진행 저장 중…' : '진행 저장 중… 잠시만 기다려 주세요'/);
  assert.match(resultBlock, /'첫 클리어 저장 완료 · 다음 스테이지 개방'/, 'desktop result must retain full first-clear wording');
  assert.match(resultBlock, /'브라우저 영구 저장 실패 · 현재 탭에서는 진행 유지'/, 'desktop result must retain full save-failure wording');
});

test('shared buttons recover from touch or pointer cancellation instead of staying visually pressed', async () => {
  const source = await readMain();
  const buttonStart = source.indexOf('function addButton');
  const backdropStart = source.indexOf('function drawBackdrop');
  assert.ok(buttonStart >= 0 && backdropStart > buttonStart);
  const buttonBlock = source.slice(buttonStart, backdropStart);
  assert.match(buttonBlock, /bg\.on\('pointerout', \(\) => \{/);
  assert.match(buttonBlock, /container\.setScale\(1\);/);
  assert.match(buttonBlock, /bg\.on\('pointerupoutside', \(\) => container\.setScale\(1\)\);/);
  assert.match(buttonBlock, /bg\.on\('pointerdown', \(\) => container\.setScale\(0\.98\)\);/);
});

test('Phaser uses smooth filtering for the current non-pixel-art character sheets', async () => {
  const source = await readMain();
  assert.match(source, /antialias:\s*true/);
  assert.match(source, /pixelArt:\s*false/);
  assert.match(source, /roundPixels:\s*false/);
  assert.doesNotMatch(source, /pixelArt:\s*true/);
  assert.doesNotMatch(source, /roundPixels:\s*true/);
});

test('stage cards render the restored twelve-step difficulty scale without legacy five-star overflow', async () => {
  const source = await readMain();
  assert.match(source, /`난이도 \$\{stage\.difficulty\} \/ 12`/);
  assert.doesNotMatch(source, /const stars = '★'\.repeat/);
});
