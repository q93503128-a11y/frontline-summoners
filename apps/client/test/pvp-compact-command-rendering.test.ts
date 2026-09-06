import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

function assertSafeCompactLabelFitting(source: string): void {
  assert.match(source, /function fitCompactButtonLabel\(/);
  assert.match(source, /Number\.parseFloat\(String\(label\.style\.fontSize\)\)/);
  assert.match(source, /const maxWidth = Math\.max\(48, width - 20\);/);
  assert.match(source, /const maxHeight = Math\.max\(30, height - 16\);/);
  assert.match(source, /label\.width > maxWidth \|\| label\.height > maxHeight/);
  assert.match(source, /label\.setFontSize\(fontSize\)/);
}

test('compact 1v1 and friendly duel rails fit multiline summon and command labels inside their touch cells', async () => {
  const source = await readSource('../src/pvp-mobile-safe-match-scenes.ts');
  assertSafeCompactLabelFitting(source);
  assert.match(source, /fitCompactButtonLabel\(button, geometry\.buttonWidth, geometry\.buttonHeight\)/);
  assert.match(source, /fitCompactButtonLabel\(pageButton, geometry\.buttonWidth, geometry\.buttonHeight\)/);
  assert.match(source, /fitCompactButtonLabel\(upgrade, geometry\.buttonWidth, geometry\.buttonHeight\)/);
  assert.match(source, /fitCompactButtonLabel\(weapon, geometry\.buttonWidth, geometry\.buttonHeight\)/);
  assert.match(source, /if \(isCompactMobileViewport\(\)\) carrier\.renderControls\(\);/);
});

test('compact 2v2 rail applies the same width-height fitting contract and immediate compact reflow', async () => {
  const source = await readSource('../src/pvp-2v2-mobile-safe-scenes.ts');
  assertSafeCompactLabelFitting(source);
  assert.match(source, /fitCompactButtonLabel\(button, geometry\.buttonWidth, geometry\.buttonHeight\)/);
  assert.match(source, /fitCompactButtonLabel\(upgrade, geometry\.buttonWidth, geometry\.buttonHeight\)/);
  assert.match(source, /fitCompactButtonLabel\(weapon, geometry\.buttonWidth, geometry\.buttonHeight\)/);
  assert.match(source, /if \(isCompactMobileViewport\(\)\) carrier\.renderControls\(\);/);
});
