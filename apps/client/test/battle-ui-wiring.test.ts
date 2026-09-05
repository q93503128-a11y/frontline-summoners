import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

async function readRuntime() {
  const [main, navigation, stageHub, stageSelect, deck, battle, result, ui] = await Promise.all([
    readSource('../src/main.ts'),
    readSource('../src/navigation-scenes.ts'),
    readSource('../src/stage-hub-scene.ts'),
    readSource('../src/stage-select-scene.ts'),
    readSource('../src/deck-scene.ts'),
    readSource('../src/battle-scene.ts'),
    readSource('../src/result-scene.ts'),
    readSource('../src/scene-ui.ts'),
  ]);
  return { main, navigation, stageHub, stageSelect, deck, battle, result, ui };
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

test('saved deck, levels, forms, plus levels, and permanent rewards use guest loadout authority in browser battle', async () => {
  const { battle } = await readRuntime();
  assert.match(battle, /this\.activeSlots = buildGuestDeckSlots\(progress\);/);
  assert.match(battle, /this\.state = createGuestPrototypeBattle\(this\.stage\.id, progress\);/);
  assert.doesNotMatch(battle, /getUnlockedPlayerSlots\(/);
  assert.doesNotMatch(battle, /createPrototypeBattle\(this\.stage\.id/);
});

test('player specialties reflect selected level, form, and plus level while enemy combat identity remains visible', async () => {
  const { deck, battle } = await readRuntime();
  assert.match(deck, /buildCharacterCombatSlot\(slot, level, meta\?\.selectedFormId, plusLevel\)/);
  assert.match(deck, /formatCombatTraits\(currentSlot\.definition\)/);
  assert.match(deck, /formatDamageSpecialty\(currentSlot\.definition\)/);
  assert.match(battle, /formatCompactTraits\(unit\.definition\)/);
  assert.match(battle, /unit\.team === 'ENEMY' && unit\.state !== UnitState\.Dying/);
});

test('PC battle hotkeys map 1 through 0 to saved deck order, Q to supply upgrade, and E to the selected base weapon', async () => {
  const { battle, ui } = await readRuntime();
  assert.match(ui, /'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'/);
  assert.match(battle, /BATTLE_UNIT_HOTKEY_CODES\.indexOf\(event\.code\)/);
  assert.match(battle, /const slot = this\.activeSlots\[slotIndex\];/);
  assert.doesNotMatch(battle, /const slot = PLAYER_SLOTS\[slotIndex\];/);
  assert.match(battle, /event\.code === 'KeyQ'/);
  assert.match(battle, /event\.code === 'KeyE'/);
  assert.match(battle, /event\.code === 'KeyP' \|\| event\.code === 'Escape'/);
  assert.match(battle, /compact \? '보급소 강화' : 'Q · 보급소 강화'/);
  assert.match(battle, /const weaponName = getBaseWeaponDisplayName\(this\.state\);/);
  assert.match(battle, /const weaponPrefix = isCompactMobileViewport\(\) \? weaponName : `E · \$\{weaponName\}`;/);
  assert.match(battle, /state\.baseWeapon\.kind === 'AEGIS_EMITTER'/);
  assert.match(battle, /state\.baseWeapon\.kind === 'SUPPLY_DROP'/);
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

test('locked-stage and save-pending clicks are quiet; camera shake stays limited to combat impact paths', async () => {
  const { stageSelect, result, battle } = await readRuntime();
  assert.match(stageSelect, /if \(!this\.progressLoaded \|\| !unlocked\) return;/);
  assert.match(stageSelect, /if \(!onlineWritable\) \{ this\.scene\.start\('account'\); return; \}/);
  assert.doesNotMatch(stageSelect, /cameras\.main\.shake/);
  assert.match(result, /if \(!this\.resultRecorded\) return;/);
  assert.doesNotMatch(result, /cameras\.main\.shake/);

  const shakeCalls = battle.match(/cameras\.main\.shake\(/g) ?? [];
  assert.equal(shakeCalls.length, 3, 'camera shake must stay limited to base weapon success, heavy unit impact, and base impact');
  assert.match(battle, /private playBaseWeaponFx\(\): void[\s\S]*?cameras\.main\.shake/);
  assert.match(battle, /private playUnitImpactFx[\s\S]*?cameras\.main\.shake/);
  assert.match(battle, /private playBaseImpactFx[\s\S]*?cameras\.main\.shake/);
});

test('sortie flow uses the active collection hub and canonical normal/special clear save authorities', async () => {
  const { main, navigation, stageHub, stageSelect, result } = await readRuntime();
  assert.match(navigation, /'출 정', \(\) => this\.scene\.start\('stage-hub'\)/);
  assert.doesNotMatch(navigation, /export class StageHubScene|export class StageSelectScene/);
  assert.match(stageHub, /export class StageHubScene extends Phaser\.Scene/);
  assert.match(stageHub, /loadActiveProgress\(\)/);
  assert.match(stageHub, /isStageCollectionUnlocked\(collection, this\.progress\.clearedStageIds\)/);
  assert.match(stageHub, /this\.scene\.start\('stage-select', \{ collectionId: collection\.id \}\)/);
  assert.match(stageSelect, /isSortieStageUnlocked\(stage\.id, this\.progress\.clearedStageIds, this\.progress\.specialClearedStageIds\)/);
  assert.doesNotMatch(stageSelect, /isBattleStageUnlocked\(/);
  assert.match(result, /recordSpecialStageClear\(this\.stage\.id\)/);
  assert.match(result, /recordNormalStageClear\(this\.stage\.id, 'SOLO_BATTLE'\)/);
  assert.match(result, /getStageCollectionForStage\(this\.stage\.id\)/);
  assert.match(main, /scene: \[BootScene, MainMenuScene, StageHubScene, StageSelectScene, BaseWeaponScene, DeckScene, CatalogScene, BattleScene, ResultScene\]/);
  assert.match(main, /game\.scene\.add\('recruitment', RecruitmentScene, false\)/);
  assert.doesNotMatch(`${navigation}\n${stageHub}\n${stageSelect}\n${result}\n${main}`, /SpecialStageSelectScene|special-select|협동 권장/);
});

test('manual deck scene uses active ownership authority, filters owned roster, and persists explicit 1-10 order', async () => {
  const { deck } = await readRuntime();
  assert.match(deck, /private getOwnedSlots\(\): readonly PrototypeRosterSlot\[\]/);
  assert.match(deck, /const owned = new Set\(getOwnedCharacterIds\(this\.progress\)\);/);
  assert.match(deck, /return ALL_PLAYER_SLOTS\.filter\(\(slot\) => owned\.has\(slot\.slotId\)\);/);
  assert.match(deck, /const filteredSlots = this\.getFilteredSlots\(\);/);
  assert.match(deck, /const visible = filteredSlots\.slice\(start, start \+ this\.pageSize\);/);
  assert.doesNotMatch(deck, /ALL_PLAYER_SLOTS\.slice\(start, start \+ this\.pageSize\)/);
  assert.match(deck, /this\.selectedIds = \[\.\.\.getEffectiveDeckSlotIds\(progress\)\];/);
  assert.match(deck, /MAX_DECK_SLOTS/);
  assert.match(deck, /this\.selectedIds\.push\(slotId\);/);
  assert.match(deck, /recordActiveDeck\(this\.selectedIds\)/);
  assert.match(deck, /resetActiveDeckToAutomatic\(\)/);
  assert.doesNotMatch(deck, /recordGuestDeck\(this\.selectedIds\)/);
  assert.match(deck, /hotkeyLabel\(index\)/);
  assert.match(deck, /선택된 순서가 1~0 소환 순서/);
  assert.match(deck, /보유 캐릭터만 표시/);
  assert.doesNotMatch(deck, /PLAYER_SLOTS\.forEach/);
});

test('compact mobile battle HUD uses shared viewport classification and keeps touch hitboxes inside the HUD', async () => {
  const { main, battle, ui } = await readRuntime();
  const viewport = await readSource('../src/viewport.ts');
  assert.match(battle, /import \{ isCompactMobileViewport, isPortraitMobileViewport \} from '\.\/viewport';/);
  assert.match(ui, /import \{[^}]*isCompactMobileViewport[^}]*\} from '\.\/viewport';/);
  assert.match(viewport, /COMPACT_MOBILE_SHORT_SIDE = 540/);
  assert.match(viewport, /coarsePointer && Math\.min\(width, height\) <= COMPACT_MOBILE_SHORT_SIDE/);
  assert.match(battle, /const buttonHeight = compact \? 84 : 62;/);
  assert.match(battle, /const y = compact \? 582 \+ row \* 84 : 579 \+ row \* 72;/);
  assert.match(battle, /const controlHeight = compact \? 84 : 60;/);
  assert.match(battle, /const weaponY = compact \? 666 : 651;/);
  assert.match(main, /width: INTERNAL_WIDTH/);
  assert.match(main, /height: INTERNAL_HEIGHT/);

  const hudTop = 540;
  const hudBottom = 720;
  const height = 84;
  for (const center of [582, 666]) {
    assert.ok(center - height / 2 >= hudTop);
    assert.ok(center + height / 2 <= hudBottom);
  }
  const lastUnitRight = 102 + 4 * 205 + 188 / 2;
  const controlLeft = 1145 - 220 / 2;
  assert.ok(lastUnitRight < controlLeft);
  assert.ok(height * (390 / 720) >= 44);
});

test('compact navigation and result controls remain finger-sized', async () => {
  const { deck, battle, result, ui } = await readRuntime();
  assert.match(ui, /const minimumTouch = compact \? getCurrentMinimumInternalTouchTarget\(\) : 0;/);
  assert.match(ui, /Math\.max\(height, minimumTouch\)/);
  assert.match(deck, /compact \? 84 : 48/);
  assert.match(battle, /compact \? 84 : 42, '일시정지'/);
  assert.match(result, /const resultButtonHeight = compact \? 84 : 68;/);
  assert.ok(84 * (390 / 720) >= 44);
});

test('stage briefing exposes permanent reward state for main stages and separate clear records for special stages', async () => {
  const { stageSelect } = await readRuntime();
  assert.match(stageSelect, /const special = this\.collection\.stageType === 'SPECIAL'/);
  assert.match(stageSelect, /const rewardOwned = !special && stage\.permanentRewardId !== undefined && this\.progress\.permanentRewardIds\.includes\(stage\.permanentRewardId\);/);
  assert.match(stageSelect, /const rewardText = getPermanentRewardEffectText\(stage\.permanentRewardId\);/);
  assert.match(stageSelect, /첫 직접 클리어/);
  assert.match(stageSelect, /클리어 기록 완료|메인 진도와 별도 클리어 기록/);
  assert.match(stageSelect, /BATTLEFIELD_THEME_LABELS\[stage\.theme\]/);
  assert.match(stageSelect, /전장 \$\{stage\.mapLength\}m/);
  assert.match(stageSelect, /동시 출격 \$\{effectiveCap\}기/);
  assert.doesNotMatch(stageSelect, /확정 보물|stage\.treasure/);
});

test('manual deck cards keep level, plus level, form, rarity, role, and combat identity', async () => {
  const { deck } = await readRuntime();
  assert.match(deck, /const compact = isCompactMobileViewport\(\);/);
  assert.match(deck, /slot\.rarity/);
  assert.match(deck, /slot\.role/);
  assert.match(deck, /selectedFormName\(this\.progress, slot\.slotId\)/);
  assert.match(deck, /buildCharacterCombatSlot\(slot, level, meta\?\.selectedFormId, plusLevel\)/);
  assert.match(deck, /const filteredSlots = this\.getFilteredSlots\(\);/);
  assert.match(deck, /보유 캐릭터만 표시/);
  assert.doesNotMatch(deck, /모집 미획득|LOCK|미보유/);
});

test('main and result scenes use player-facing permanent reward and special-operation wording', async () => {
  const { navigation, result } = await readRuntime();
  assert.match(navigation, /const menuButtonHeight = compact \? 108 : 92;/);
  assert.match(navigation, /const owned = getOwnedCharacterIds\(progress\)\.length;/);
  assert.match(navigation, /영구 보상 \$\{progress\.permanentRewardIds\.length\}/);

  assert.match(result, /const compact = isCompactMobileViewport\(\);/);
  assert.match(result, /'영구 보상 획득'/);
  assert.match(result, /getPermanentRewardEffectText\(this\.stage\.permanentRewardId\)/);
  assert.match(result, /진행 저장 완료 · 다음 전장 개방\$\{storySuffix\}/);
  assert.match(result, /'브라우저 영구 저장 실패 · 현재 탭에서는 진행 유지'/);
  assert.match(result, /'특수 작전 클리어'/);
  assert.match(result, /'특수 작전 첫 클리어 저장 완료'/);
  assert.match(result, /'특수 작전 재클리어 보상 저장 완료'/);
  assert.doesNotMatch(result, /훈장 획득|stage\.treasure/);
});

test('shared buttons recover from touch or pointer cancellation instead of staying visually pressed', async () => {
  const { ui } = await readRuntime();
  const buttonStart = ui.indexOf('export function addButton');
  const backdropStart = ui.indexOf('export function drawBackdrop');
  assert.ok(buttonStart >= 0 && backdropStart > buttonStart);
  const buttonBlock = ui.slice(buttonStart, backdropStart);
  assert.match(buttonBlock, /hit\.on\('pointerout', \(\) => \{/);
  assert.match(buttonBlock, /pressed = false;/);
  assert.match(buttonBlock, /container\.setScale\(1\);/);
  assert.match(buttonBlock, /hit\.on\('pointerupoutside', \(\) => \{[\s\S]*?container\.setScale\(1\);[\s\S]*?\}\);/);
  assert.match(buttonBlock, /hit\.on\('pointerdown', \(\) => \{[\s\S]*?if \(!shouldUseReducedMotion\(\)\) container\.setScale\(0\.985\);[\s\S]*?\}\);/);
});

test('Phaser uses smooth filtering for current non-pixel-art character sheets', async () => {
  const { main } = await readRuntime();
  assert.match(main, /antialias:\s*true/);
  assert.match(main, /pixelArt:\s*false/);
  assert.match(main, /roundPixels:\s*false/);
  assert.doesNotMatch(main, /pixelArt:\s*true|roundPixels:\s*true/);
});

test('stage briefing renders the twelve-step difficulty scale without legacy five-star overflow', async () => {
  const { stageSelect } = await readRuntime();
  assert.match(stageSelect, /`난이도 \$\{stage\.difficulty\}\/12/);
  assert.doesNotMatch(stageSelect, /const stars = '★'\.repeat/);
});
