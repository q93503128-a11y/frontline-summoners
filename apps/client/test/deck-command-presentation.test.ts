import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('main routes formation through the command presentation wrapper', async () => {
  const main = await readSource('../src/main.ts');
  assert.match(main, /import \{ DeckScene \} from '\.\/deck-command-scene'/);
});

test('formation presentation makes the 1-to-0 summon rail the primary visual surface', async () => {
  const presentation = await readSource('../src/deck-command-scene.ts');
  assert.match(presentation, /carrier\.renderDeckOrder = \(\) => renderFormationOrder\(carrier\)/);
  assert.match(presentation, /const y = 166;/);
  assert.match(presentation, /resolveUnitArt\(rosterSlot\.definition\.id, meta\?\.selectedFormId\)/);
  assert.match(presentation, /hotkeyLabel\(index\)/);
  assert.match(presentation, /`◆\$\{rosterSlot\.cost\}`/);
  assert.match(presentation, /'빈 슬롯'/);
});

test('roster cards keep three readable information tiers and a fixed footer safety gap', async () => {
  const presentation = await readSource('../src/deck-command-scene.ts');
  assert.match(presentation, /const cardHeight = 124;/);
  assert.match(presentation, /const startY = compact \? 404 : 374;/);
  assert.match(presentation, /const yGap = compact \? 128 : 132;/);
  assert.match(presentation, /const growthLine = text/);
  assert.match(presentation, /const combatLine = text/);
  assert.doesNotMatch(presentation, /탭 추가 · 드래그로 슬롯 배치|탭 제외 · 드래그로 순서 교환/);

  const compactSecondRowBottom = 404 + 128 + 124 / 2;
  const desktopSecondRowBottom = 374 + 132 + 124 / 2;
  assert.ok(624 - compactSecondRowBottom >= 20);
  assert.ok(620 - desktopSecondRowBottom >= 40);
});
