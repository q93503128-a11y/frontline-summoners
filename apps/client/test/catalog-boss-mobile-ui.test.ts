import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('main menu opens the real catalog scene and the scene is registered', async () => {
  const [main, navigation] = await Promise.all([
    readSource('../src/main.ts'),
    readSource('../src/navigation-scenes.ts'),
  ]);
  assert.match(navigation, /'도 감', \(\) => this\.scene\.start\('catalog'\)/);
  assert.doesNotMatch(navigation, /도 감\s*·\s*준비 중/);
  assert.match(main, /scene:\s*\[[^\]]*CatalogScene[^\]]*\]/s);
});

test('catalog pages all 43 allies, permanent rewards, and separate special clear records without mixing reward axes', async () => {
  const source = await readSource('../src/catalog-scene.ts');
  assert.match(source, /const ALLY_PAGE_SIZE = 5/);
  assert.match(source, /const REWARD_PAGE_SIZE = 5/);
  assert.match(source, /const SPECIAL_PAGE_SIZE = 5/);
  assert.match(source, /type CatalogMode = 'ALLIES' \| 'REWARDS' \| 'SPECIAL'/);
  assert.match(source, /`동료 \$\{ALL_PLAYER_SLOTS\.length\}종`/);
  assert.match(source, /'영구 보상 20개'/);
  assert.match(source, /'특수 기록 5개'/);
  assert.match(source, /loadGuestProgress\(\)/);
  assert.match(source, /new Set\(getOwnedCharacterIds\(this\.progress\)\)/);
  assert.match(source, /ALL_PLAYER_SLOTS\.slice\(start, start \+ ALLY_PAGE_SIZE\)/);
  assert.match(source, /owned \? slot\.displayName : '\?\?\?'/);
  assert.match(source, /portrait\.setTintFill\(0x07080b\)/);
  assert.match(source, /'획득 후 정보 공개'/);
  assert.match(source, /new Set\(this\.progress\.permanentRewardIds\)/);
  assert.match(source, /new Set\(this\.progress\.specialClearedStageIds\)/);
  assert.match(source, /formatCombatTraits\(slot\.definition\)/);
  assert.match(source, /formatDamageSpecialty\(slot\.definition\)/);
  assert.match(source, /NORMAL_CLEAR 첫 승리 시 확정/);
  assert.match(source, /메인 영구 성장과 별도 기록/);
  assert.doesNotMatch(source, /getUnlockedSlotIds\(this\.progress\.clearedStageIds\)/);
});

test('runtime and catalog share the coarse-pointer compact-mobile classifier instead of treating short desktop windows as phones', async () => {
  const [battle, ui, catalog, viewport] = await Promise.all([
    readSource('../src/battle-scene.ts'),
    readSource('../src/scene-ui.ts'),
    readSource('../src/catalog-scene.ts'),
    readSource('../src/viewport.ts'),
  ]);

  assert.match(battle, /import \{ isCompactMobileViewport, isPortraitMobileViewport \} from '\.\/viewport';/);
  assert.match(ui, /import \{ isCompactMobileViewport \} from '\.\/viewport';/);
  assert.match(catalog, /import \{ isCompactMobileViewport \} from '\.\/viewport';/);
  assert.doesNotMatch(`${battle}\n${ui}\n${catalog}`, /function isCompactMobileViewport\(/);
  assert.doesNotMatch(battle, /function isPortraitMobileViewport\(/);

  assert.match(viewport, /COMPACT_MOBILE_SHORT_SIDE = 540/);
  assert.match(viewport, /coarsePointer && Math\.min\(width, height\) <= COMPACT_MOBILE_SHORT_SIDE/);
  assert.match(viewport, /window\.matchMedia\('\(pointer: coarse\)'\)\.matches/);

  assert.match(ui, /const renderedSize = isCompactMobileViewport\(\) \? Math\.max\(size, 16\) : size;/);
  assert.match(ui, /fontSize: `\$\{renderedSize\}px`/);
  assert.match(ui, /strokeThickness: renderedSize >= 30 \? 4 : 0/);
  assert.match(catalog, /const renderedSize = isCompactMobileViewport\(\) \? Math\.max\(size, 16\) : size;/);
  assert.match(catalog, /fontSize: `\$\{renderedSize\}px`/);
});

test('catalog keeps desktop descriptions while compact cards prioritize readable identity and stats', async () => {
  const source = await readSource('../src/catalog-scene.ts');
  assert.match(source, /const compact = isCompactMobileViewport\(\);/);
  assert.match(source, /compact \? 27 : 22/);
  assert.match(source, /compact \? 21 : 14/);
  assert.match(source, /if \(compact\) \{[\s\S]*?HP \$\{slot\.definition\.maxHp\} · 공격 \$\{slot\.definition\.attackDamage\}/);
  assert.match(source, /else \{[\s\S]*?slot\.description/);
  assert.match(source, /재생산 \$\{\(slot\.rechargeFrames \/ 30\)\.toFixed\(1\)\}초/);
  assert.match(source, /if \(!compact\) this\.contentLayer!\.add\(addText\(this, x, 548, `\$\{stage\.name\}\\nNORMAL_CLEAR 첫 승리 시 확정`/);
  assert.match(source, /private renderSpecialRecords\(\): void/);
  assert.match(source, /`SPECIAL \$\{specialNumber\}`/);
  assert.match(source, /`난이도 \$\{stage\.difficulty\} \/ 12`/);
});

test('compact catalog navigation stays finger-sized, drops decorative header copy, and cancelled drags restore button scale', async () => {
  const source = await readSource('../src/catalog-scene.ts');
  assert.match(source, /const navigationHeight = compact \? 84 : 50;/);
  assert.match(source, /const tabHeight = compact \? 84 : 54;/);
  assert.match(source, /isCompactMobileViewport\(\) \? 26 : 18/);
  assert.match(source, /if \(!compact\) addText\(this, 56, 88, '동료, 메인 영구 보상, 특수전 클리어 기록을 한곳에서 확인한다\.'/);
  assert.match(source, /bg\.on\('pointerout', \(\) => \{[\s\S]*?container\.setScale\(1\);/);
  assert.match(source, /bg\.on\('pointerupoutside', \(\) => container\.setScale\(1\)\);/);
  assert.ok(84 * (390 / 720) >= 44);
});

test('boss arrival warning is keyed by actual BOSS-tagged simulation units and only fires once per instance', async () => {
  const [battle, warning] = await Promise.all([
    readSource('../src/battle-scene.ts'),
    readSource('../src/boss-warning.ts'),
  ]);
  const stepIndex = battle.indexOf('stepPlayableBattle(this.state);');
  const warningIndex = battle.indexOf('this.syncBossWarnings();');

  assert.ok(stepIndex >= 0 && warningIndex > stepIndex, 'boss warning scan must observe the post-spawn deterministic state');
  assert.match(battle, /seenBossSimulationIds = new Set<number>/);
  assert.match(battle, /\(unit\.definition\.combatTags \?\? \[\]\)\.includes\('BOSS'\)/);
  assert.match(battle, /this\.seenBossSimulationIds\.has\(unit\.simulationId\)/);
  assert.match(battle, /this\.seenBossSimulationIds\.add\(unit\.simulationId\)/);
  assert.match(battle, /showBossArrival\(this, enemy\?\.displayName \?\? '우두머리'\)/);
  assert.doesNotMatch(warning, /@frontline\/sim/);
  assert.match(warning, /Purely visual warning/);
});

test('portrait mobile view blocks tiny layout and freezes battle before the 30Hz accumulator advances', async () => {
  const [battle, viewport, html] = await Promise.all([
    readSource('../src/battle-scene.ts'),
    readSource('../src/viewport.ts'),
    readSource('../index.html'),
  ]);
  const updateStart = battle.indexOf('update(_: number, delta: number): void {');
  const guardIndex = battle.indexOf('isPortraitMobileViewport()) return;', updateStart);
  const accumulatorIndex = battle.indexOf('this.accumulator += Math.min(delta, 120);', updateStart);

  assert.match(battle, /import \{ isCompactMobileViewport, isPortraitMobileViewport \} from '\.\/viewport';/);
  assert.match(viewport, /shouldBlockPortraitMobile\(width: number, height: number, coarsePointer: boolean\)/);
  assert.match(viewport, /coarsePointer && width <= PORTRAIT_MOBILE_MAX_WIDTH && height > width/);
  assert.ok(updateStart >= 0 && guardIndex > updateStart && accumulatorIndex > guardIndex, 'portrait guard must return before simulation time accumulates');
  assert.match(battle, /this\.manuallyPaused\s*\|\|\s*isPortraitMobileViewport\(\)/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /@media \(orientation: portrait\) and \(max-width: 900px\) and \(pointer: coarse\)/);
  assert.doesNotMatch(html, /@media \(orientation: portrait\) and \(max-width: 900px\)\s*\{/);
  assert.match(html, /id="orientation-hint"/);
  assert.match(html, /가로 화면으로 돌려 주세요/);
  assert.doesNotMatch(html, /canvas\s*\{[^}]*image-rendering:\s*pixelated/s);
});

test('mobile viewport-fit keeps Phaser inside device safe areas without changing the desktop zero-inset layout', async () => {
  const html = await readSource('../index.html');
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /body\s*\{[\s\S]*?box-sizing:\s*border-box/);
  assert.match(html, /padding-top:\s*env\(safe-area-inset-top, 0px\)/);
  assert.match(html, /padding-right:\s*env\(safe-area-inset-right, 0px\)/);
  assert.match(html, /padding-bottom:\s*env\(safe-area-inset-bottom, 0px\)/);
  assert.match(html, /padding-left:\s*env\(safe-area-inset-left, 0px\)/);
  assert.match(html, /#game\s*\{\s*width:\s*100%;\s*height:\s*100%;\s*\}/);
  assert.match(html, /max\(32px, env\(safe-area-inset-left, 0px\)\)/);
  assert.match(html, /max\(32px, env\(safe-area-inset-right, 0px\)\)/);
});
