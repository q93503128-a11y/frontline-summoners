import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('main menu opens the real catalog scene and the scene is registered', async () => {
  const source = await readSource('../src/main.ts');
  assert.match(source, /'도 감', \(\) => this\.scene\.start\('catalog'\)/);
  assert.doesNotMatch(source, /도 감\s*·\s*준비 중/);
  assert.match(source, /scene:\s*\[[^\]]*CatalogScene[^\]]*\]/s);
});

test('catalog is progress-aware and pages allies and guaranteed treasures instead of overfilling one screen', async () => {
  const source = await readSource('../src/catalog-scene.ts');
  assert.match(source, /const ALLY_PAGE_SIZE = 5/);
  assert.match(source, /const TREASURE_PAGE_SIZE = 5/);
  assert.match(source, /loadGuestProgress\(\)/);
  assert.match(source, /getUnlockedSlotIds\(this\.progress\.clearedStageIds\)/);
  assert.match(source, /new Set\(this\.progress\.treasureIds\)/);
  assert.match(source, /formatCombatTraits\(slot\.definition\)/);
  assert.match(source, /formatDamageSpecialty\(slot\.definition\)/);
  assert.match(source, /첫 클리어 100% 확정/);
  assert.match(source, /능력치는 합류 후 공개/);
});

test('compact mobile breakpoint covers short landscape phones in core and catalog scenes', async () => {
  const main = await readSource('../src/main.ts');
  const catalog = await readSource('../src/catalog-scene.ts');

  assert.match(main, /function isCompactMobileViewport\(\): boolean/);
  assert.match(main, /Math\.min\(window\.innerWidth, window\.innerHeight\) <= 540/);
  assert.match(main, /const renderedSize = isCompactMobileViewport\(\) \? Math\.max\(size, 16\) : size;/);
  assert.match(main, /fontSize: `\$\{renderedSize\}px`/);
  assert.match(main, /strokeThickness: renderedSize >= 30 \? 4 : 0/);

  assert.match(catalog, /function isCompactMobileViewport\(\): boolean/);
  assert.match(catalog, /Math\.min\(window\.innerWidth, window\.innerHeight\) <= 540/);
  assert.match(catalog, /const renderedSize = isCompactMobileViewport\(\) \? Math\.max\(size, 16\) : size;/);
  assert.match(catalog, /fontSize: `\$\{renderedSize\}px`/);
});

test('boss arrival warning is keyed by actual BOSS-tagged simulation units and only fires once per instance', async () => {
  const main = await readSource('../src/main.ts');
  const warning = await readSource('../src/boss-warning.ts');
  const stepIndex = main.indexOf('stepPlayableBattle(this.state);');
  const warningIndex = main.indexOf('this.syncBossWarnings();');

  assert.ok(stepIndex >= 0 && warningIndex > stepIndex, 'boss warning scan must observe the post-spawn deterministic state');
  assert.match(main, /seenBossSimulationIds = new Set<number>/);
  assert.match(main, /\(unit\.definition\.traits \?\? \[\]\)\.includes\('BOSS'\)/);
  assert.match(main, /this\.seenBossSimulationIds\.has\(unit\.simulationId\)/);
  assert.match(main, /this\.seenBossSimulationIds\.add\(unit\.simulationId\)/);
  assert.match(main, /showBossArrival\(this, enemy\?\.displayName \?\? '우두머리'\)/);
  assert.doesNotMatch(warning, /@frontline\/sim/);
  assert.match(warning, /Purely visual warning/);
});

test('portrait mobile view blocks tiny layout and freezes battle before the 30Hz accumulator advances', async () => {
  const main = await readSource('../src/main.ts');
  const html = await readSource('../index.html');
  const updateStart = main.indexOf('update(_: number, delta: number): void {');
  const guardIndex = main.indexOf('isPortraitMobileViewport()) return;', updateStart);
  const accumulatorIndex = main.indexOf('this.accumulator += Math.min(delta, 120);', updateStart);

  assert.match(main, /function isPortraitMobileViewport\(\): boolean/);
  assert.ok(updateStart >= 0 && guardIndex > updateStart && accumulatorIndex > guardIndex, 'portrait guard must return before simulation time accumulates');
  assert.match(main, /this\.manuallyPaused\s*\|\|\s*isPortraitMobileViewport\(\)/, 'manual pause and portrait guard must share the pre-accumulator stop path');
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /@media \(orientation: portrait\) and \(max-width: 900px\)/);
  assert.match(html, /id="orientation-hint"/);
  assert.match(html, /가로 화면으로 돌려 주세요/);
  assert.doesNotMatch(html, /canvas\s*\{[^}]*image-rendering:\s*pixelated/s);
});
