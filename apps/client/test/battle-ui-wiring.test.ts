import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

async function readRuntime() {
  const [main, navigation, deck, battle, result, ui] = await Promise.all([
    readSource('../src/main.ts'),
    readSource('../src/navigation-scenes.ts'),
    readSource('../src/deck-scene.ts'),
    readSource('../src/battle-scene.ts'),
    readSource('../src/result-scene.ts'),
    readSource('../src/scene-ui.ts'),
  ]);
  return { main, navigation, deck, battle, result, ui };
}

test('battle loop launches ranged visuals before deterministic damage step and then advances projectile views', async () => {
  const { battle } = await readRuntime();
  const launchIndex = battle.indexOf('this.syncProjectileLaunches();');
  const stepIndex = battle.indexOf('stepPlayableBattle(this.state);');
  const renderIndex = battle.indexOf('this.syncProjectileViews();');
  assert.ok(launchIndex >= 0);
  assert.ok(stepIndex > launchIndex);
  assert.ok(renderIndex > stepIndex);
});

test('travel projectiles replace caster-local hit FX and interpolate render position between 30Hz ticks', async () => {
  const { battle } = await readRuntime();
  assert.match(battle, /impactMoment && !usesTravelProjectile\(art\.attackFx\)/);
  assert.match(battle, /getProjectileTravelPlan\(art\.attackFx, firstHitFrame, Math\.abs\(endX - startX\)\)/);
  assert.match(battle, /const fractionalTick = Math\.max\(0, Math\.min\(1, this\.accumulator \/ SIM_TICK_MS\)\);/);
  assert.match(battle, /const renderTick = this\.state\.battle\.tick \+ fractionalTick;/);
  assert.match(battle, /\(renderTick - projectile\.startTick\) \/ span/);
  assert.match(battle, /getProjectileArcOffsetY\(projectile\.style, progress\)/);
});

test('saved deck, levels, forms, and treasures use the guest loadout authority in the actual browser battle', async () => {
  const { battle } = await readRuntime();
  assert.match(battle, /this\.activeSlots = buildGuestDeckSlots\(progress\);/);
  assert.match(battle, /this\.state = createGuestPrototypeBattle\(this\.stage\.id, progress\);/);
  assert.doesNotMatch(battle, /getUnlockedPlayerSlots\(/);
  assert.doesNotMatch(battle, /createPrototypeBattle\(this\.stage\.id/);
});

test('player specialties are visible from the selected level and form while enemy traits remain visible in battle', async () => {
  const { deck, battle } = await readRuntime();
  assert.match(deck, /buildCharacterCombatSlot\(slot, level, meta\?\.selectedFormId\)/);
  assert.match(deck, /formatCombatTraits\(currentSlot\.definition\)/);
  assert.match(deck, /formatDamageSpecialty\(currentSlot\.definition\)/);
  assert.match(battle, /formatCompactTraits\(unit\.definition\)/);
  assert.match(battle, /unit\.team === 'ENEMY' && unit\.state !== UnitState\.Dying/);
});

test('PC battle hotkeys map 1 through 0 to current saved deck order, Q to supply upgrade, and E to the base weapon', async () => {
  const { battle, ui } = await readRuntime();
  assert.match(ui, /'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'/);
  assert.match(battle, /BATTLE_UNIT_HOTKEY_CODES\.indexOf\(event\.code\)/);
  assert.match(battle, /const slot = this\.activeSlots\[slotIndex\];/);
  assert.doesNotMatch(battle, /const slot = PLAYER_SLOTS\[slotIndex\];/);
  assert.match(battle, /event\.code === 'KeyQ'/);
  assert.match(battle, /event\.code === 'KeyE'/);
  assert.match(battle, /event\.code === 'KeyP' \|\| event\.code === 'Escape'/);
  assert.match(battle, /compact \? '보급소 강화' : 'Q · 보급소 강화'/);
  assert.match(battle, /const weaponPrefix = isCompactMobileViewport\(\) \? '전선포' : 'E · 전선포'/);
  assert.match(battle, /const hotkeyLabel = getUnitHotkeyLabel\(index\);/);
});

test('mouse and keyboard battle actions share quiet failure paths without camera shake', async () => {
  const { battle } = await readRuntime();
  assert.match(battle, /bg\.on\('pointerdown', \(\) => this\.trySpawnSlot\(slot\.slotId\)\)/);
  assert.match(battle, /upgradeBg\.on\('pointerdown', \(\) => this\.tryUpgradeSupplyInput\(\)\)/);
  assert.match(battle, /this\.baseWeaponBg\.on\('pointerdown', \(\) => this\.tryFireBaseWeaponInput\(\)\)/);

  const actionStart = battle.indexOf('private trySpawnSlot');
  const actionEnd = battle.indexOf('private toggleManualPause');
  assert.ok(actionStart >= 0 && actionEnd > actionStart);
  const actionBlock = battle.slice(actionStart, actionEnd);
  assert.match(actionBlock, /trySpawnPlayerUnit\(this\.state, slotId\);/);
  assert.match(actionBlock, /tryUpgradeSupply\(this\.state\);/);
  assert.match(actionBlock, /const result = tryFireBaseWeapon\(this\.state\);/);
  assert.match(actionBlock, /if \(result\.ok\) this\.playBaseWeaponFx\(\);/);
  assert.doesNotMatch(actionBlock, /cameras\.main\.shake/);
});

test('locked-stage and save-pending clicks are quiet; camera shake remains limited to combat impact paths', async () => {
  const { navigation, result, battle } = await readRuntime();
  assert.match(navigation, /if \(unlocked\) this\.scene\.start\('battle', \{ stageId: stage\.id \}\);/);
  assert.doesNotMatch(navigation, /cameras\.main\.shake/);
  assert.match(result, /if \(!this\.resultRecorded\) return;/);
  assert.doesNotMatch(result, /cameras\.main\.shake/);

  const shakeCalls = battle.match(/cameras\.main\.shake\(/g) ?? [];
  assert.equal(shakeCalls.length, 3, 'camera shake must stay limited to base weapon success, heavy unit impact, and base impact');
  assert.match(battle, /private playBaseWeaponFx\(\): void[\s\S]*?cameras\.main\.shake/);
  assert.match(battle, /private playUnitImpactFx[\s\S]*?cameras\.main\.shake/);
  assert.match(battle, /private playBaseImpactFx[\s\S]*?cameras\.main\.shake/);
});

test('sortie flow uses the scalable collection hub, one shared stage list, and the sortie unlock authority', async () => {
  const { main, navigation, result } = await readRuntime();
  assert.match(navigation, /'출 정', \(\) => this\.scene\.start\('stage-hub'\)/);
  assert.match(navigation, /export class StageHubScene extends Phaser\.Scene/);
  assert.match(navigation, /STAGE_COLLECTIONS\.forEach\(\(collection, index\) =>/);
  assert.match(navigation, /isStageCollectionUnlocked\(collection, this\.progress\.clearedStageIds\)/);
  assert.match(navigation, /this\.scene\.start\('stage-select', \{ collectionId: collection\.id \}\)/);
  assert.match(navigation, /export class StageSelectScene extends Phaser\.Scene/);
  assert.match(navigation, /getStageCollection\(data\.collectionId \?\? STAGE_COLLECTIONS\[0\]!\.id\)/);
  assert.match(navigation, /const special = this\.collection\.stageType === 'SPECIAL'/);
  assert.match(navigation, /this\.collection\.stages\.slice\(start, start \+ 5\)/);
  assert.match(navigation, /isSortieStageUnlocked\(stage\.id, this\.progress\.clearedStageIds\)/);
  assert.doesNotMatch(navigation, /isBattleStageUnlocked\(/);
  assert.match(result, /recordSpecialStageClear\(this\.stage\.id\)/);
  assert.match(result, /recordStageClear\(this\.stage\.id, this\.stage\.treasure\.id\)/);
  assert.match(result, /getStageCollectionForStage\(this\.stage\.id\)/);
  assert.match(main, /scene: \[BootScene, MainMenuScene, StageHubScene, StageSelectScene, DeckScene, CatalogScene, BattleScene, ResultScene\]/);
  assert.doesNotMatch(`${navigation}\n${result}\n${main}`, /SpecialStageSelectScene|special-select|협동 권장/);
});

test('manual deck scene uses save ownership authority, supports all 25 definitions, and persists explicit 1-10 order', async () => {
  const { deck } = await readRuntime();
  assert.match(deck, /ALL_PLAYER_SLOTS\.slice\(start, start \+ this\.pageSize\)/);
  assert.match(deck, /const owned = new Set\(getOwnedCharacterIds\(this\.progress\)\);/);
  assert.match(deck, /this\.selectedIds = \[\.\.\.getEffectiveDeckSlotIds\(progress\)\];/);
  assert.match(deck, /MAX_DECK_SLOTS/);
  assert.match(deck, /this\.selectedIds\.push\(slotId\);/);
  assert.match(deck, /recordGuestDeck\(this\.selectedIds\)/);
  assert.match(deck, /resetGuestDeckToAutomatic\(\)/);
  assert.match(deck, /hotkeyLabel\(index\)/);
  assert.match(deck, /선택 순서가 전투의 1~0 단축키 순서/);
  assert.doesNotMatch(deck, /PLAYER_SLOTS\.forEach/);
});

test('compact mobile battle HUD uses the shared coarse-pointer classifier and keeps desktop shortcuts intact', async () => {
  const { main, battle, ui } = await readRuntime();
  const viewport = await readSource('../src/viewport.ts');
  assert.match(battle, /import \{ isCompactMobileViewport, isPortraitMobileViewport \} from '\.\/viewport';/);
  assert.match(ui, /import \{ isCompactMobileViewport \} from '\.\/viewport';/);
  assert.doesNotMatch(`${battle}\n${ui}`, /function isCompactMobileViewport\(/);
  assert.match(viewport, /COMPACT_MOBILE_SHORT_SIDE = 540/);
  assert.match(viewport, /coarsePointer && Math\.min\(width, height\) <= COMPACT_MOBILE_SHORT_SIDE/);
  assert.match(ui, /function battleUiFontSize\(regular: number, compact: number\): number/);
  assert.match(battle, /const buttonHeight = compact \? 84 : 62;/);
  assert.match(battle, /const y = compact \? 582 \+ row \* 84 : 579 \+ row \* 72;/);
  assert.match(battle, /const controlHeight = compact \? 84 : 60;/);
  assert.match(battle, /const weaponY = compact \? 666 : 651;/);
  assert.match(battle, /const unitButtonName = compact \? slot\.displayName : `\$\{slot\.rarity\} · \$\{slot\.displayName\}`/);
  assert.match(main, /width: INTERNAL_WIDTH/);
  assert.match(main, /height: INTERNAL_HEIGHT/);
});

test('compact two-row summon and right-side control hitboxes stay inside the bottom HUD without overlap', async () => {
  const { battle } = await readRuntime();
  assert.match(battle, /const x = 102 \+ col \* 205;/);
  assert.match(battle, /const y = compact \? 582 \+ row \* 84 : 579 \+ row \* 72;/);
  assert.match(battle, /this\.add\.rectangle\(x, y, 188, buttonHeight/);
  assert.match(battle, /this\.add\.rectangle\(1145, upgradeY, 220, controlHeight/);
  assert.match(battle, /this\.add\.rectangle\(1145, weaponY, 220, controlHeight/);

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
  assert.equal(unitRows[1]! - unitRows[0]!, unitHeight);
  assert.equal(controlRows[1]! - controlRows[0]!, controlHeight);
  const lastUnitRight = 102 + 4 * 205 + 188 / 2;
  const controlLeft = 1145 - 220 / 2;
  assert.ok(lastUnitRight < controlLeft);
  assert.ok(unitHeight * (390 / 720) >= 44);
});

test('compact navigation buttons stay finger-sized across extracted sortie, deck, battle pause, and result scenes', async () => {
  const { navigation, deck, battle, result } = await readRuntime();
  assert.match(navigation, /compact \? 84 : 50/);
  assert.match(navigation, /compact \? 84 : 60/);
  assert.match(navigation, /compact \? 84 : 52/);
  assert.match(deck, /compact \? 76 : 48/);
  assert.match(battle, /compact \? 84 : 42, '일시정지'/);
  assert.match(battle, /isCompactMobileViewport\(\) \? 84 : 58/);
  assert.match(result, /const resultButtonHeight = compact \? 84 : 68;/);
  assert.ok(84 * (390 / 720) >= 44);
});

test('shared stage cards keep desktop detail while compact mobile prioritizes progression rewards and special challenge data', async () => {
  const { navigation } = await readRuntime();
  assert.match(navigation, /const special = this\.collection\.stageType === 'SPECIAL'/);
  assert.match(navigation, /if \(compact\) \{/);
  assert.match(navigation, /compact \? 28 : 25/);
  assert.match(navigation, /compact \? 535 : 548/);
  assert.match(navigation, /BATTLEFIELD_THEME_LABELS\[stage\.theme\]/);
  assert.match(navigation, /`전장 \$\{stage\.mapLength\}m`/);
  assert.match(navigation, /stage\.subtitle/);
  assert.match(navigation, /동시 출격 \$\{effectiveCap\}기/);
  assert.match(navigation, /'확정 보물'/);
  assert.match(navigation, /`첫 클리어 훈장 · \$\{stage\.treasure\.name\}`/);
});

test('manual deck cards use separate compact density without dropping level, form, rarity, role, or combat identity', async () => {
  const { deck } = await readRuntime();
  assert.match(deck, /const compact = isCompactMobileViewport\(\);/);
  assert.match(deck, /slot\.rarity/);
  assert.match(deck, /slot\.role/);
  assert.match(deck, /`\$\{slot\.role\} · Lv\$\{level\} · \$\{form\}`/);
  assert.match(deck, /selectedFormName\(this\.progress, slot\.slotId\)/);
  assert.match(deck, /buildCharacterCombatSlot\(slot, level, meta\?\.selectedFormId\)/);
  assert.match(deck, /compact \? 8 : 10/);
  assert.match(deck, /모집 미획득/);
});

test('main and result scenes use separate compact layouts while desktop keeps full wording and main count uses all owned characters', async () => {
  const { navigation, result } = await readRuntime();
  assert.match(navigation, /const menuButtonHeight = compact \? 108 : 92;/);
  assert.match(navigation, /compact \? '승리할수록 전선과 동료가 열린다\.' : '첫 출정은 징집병 하나\. 승리할수록 전선과 동료가 열린다\.'/);
  assert.match(navigation, /const owned = getOwnedCharacterIds\(progress\)\.length;/);
  assert.match(navigation, /동료 \$\{owned\}\/\$\{ALL_PLAYER_SLOTS\.length\}/);
  assert.doesNotMatch(navigation, /getUnlockedSlotIds\(progress\.clearedStageIds\)\.length/);

  assert.match(result, /const compact = isCompactMobileViewport\(\);/);
  assert.match(result, /getStageCollectionForStage\(this\.stage\.id\)/);
  assert.match(result, /compact \? 820 : 760/);
  assert.match(result, /setWordWrapWidth\(compact \? 720 : 680\)/);
  assert.match(result, /const resultButtonHeight = compact \? 84 : 68;/);
  assert.match(result, /'첫 클리어 저장 완료 · 다음 스테이지 개방'/);
  assert.match(result, /'브라우저 영구 저장 실패 · 현재 탭에서는 진행 유지'/);
  assert.match(result, /'특수전 훈장 획득'/);
});

test('shared buttons recover from touch or pointer cancellation instead of staying visually pressed', async () => {
  const { ui } = await readRuntime();
  const buttonStart = ui.indexOf('export function addButton');
  const backdropStart = ui.indexOf('export function drawBackdrop');
  assert.ok(buttonStart >= 0 && backdropStart > buttonStart);
  const buttonBlock = ui.slice(buttonStart, backdropStart);
  assert.match(buttonBlock, /bg\.on\('pointerout', \(\) => \{/);
  assert.match(buttonBlock, /container\.setScale\(1\);/);
  assert.match(buttonBlock, /bg\.on\('pointerupoutside', \(\) => container\.setScale\(1\)\);/);
  assert.match(buttonBlock, /bg\.on\('pointerdown', \(\) => container\.setScale\(0\.98\)\);/);
});

test('Phaser uses smooth filtering for the current non-pixel-art character sheets', async () => {
  const { main } = await readRuntime();
  assert.match(main, /antialias:\s*true/);
  assert.match(main, /pixelArt:\s*false/);
  assert.match(main, /roundPixels:\s*false/);
  assert.doesNotMatch(main, /pixelArt:\s*true|roundPixels:\s*true/);
});

test('stage cards render the restored twelve-step difficulty scale without legacy five-star overflow', async () => {
  const { navigation } = await readRuntime();
  assert.match(navigation, /`난이도 \$\{stage\.difficulty\} \/ 12`/);
  assert.doesNotMatch(navigation, /const stars = '★'\.repeat/);
});
