import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('growth runtime prioritizes character choice, one resource line, upgrade actions, then evolution', async () => {
  const growth = await readSource('../src/growth-command-scene.ts');
  assert.match(growth, /addSectionHeading\(this, 52, 118, '동료'/);
  assert.match(growth, /addSectionHeading\(this, 446, 118, '선택 동료'/);
  assert.match(growth, /`보유 재화 · G \$\{compactAmount\(gold\)\}/);
  assert.doesNotMatch(growth, /addStatusPill/);
  assert.match(growth, /addSectionHeading\(this, 446, 362, '강화'/);
  assert.match(growth, /const actionY = compact \? 414 : 408;/);
  assert.match(growth, /addSectionHeading\(this, 446, 480, '진화 형태'/);
  assert.match(growth, /const formButton = addButton\(this, x, 590/);
});

test('growth evolution controls keep a safe gap above the persistent status line', async () => {
  const growth = await readSource('../src/growth-command-scene.ts');
  assert.match(growth, /compact \? 84 : 70/);
  assert.match(growth, /compact \? 692 : 686/);
  const compactFormBottom = 590 + 84 / 2;
  const desktopFormBottom = 590 + 70 / 2;
  assert.ok(692 - compactFormBottom >= 50);
  assert.ok(686 - desktopFormBottom >= 60);
});

test('recruitment keeps ten-pull as the dominant summon command and reduces secondary chrome', async () => {
  const presentation = await readSource('../src/recruitment-command-scene.ts');
  assert.match(presentation, /label\.startsWith\('1회 · 결정 '\)\) container\.setScale\(0\.97\)/);
  assert.match(presentation, /label\.startsWith\('10회 · 결정 '\)\) container\.setScale\(1\.035, 1\.05\)/);
  assert.match(presentation, /body\?\.setFillStyle\(0x171d1b, 0\.78\)\.setStrokeStyle\(1, 0x9a7b4a, 0\.24\)/);
  assert.match(presentation, /sprite\.setScale\(sprite\.scaleX \* 1\.12, sprite\.scaleY \* 1\.12\)/);
  assert.match(presentation, /if \(value === '보장 횟수 없음'\) return '보장 없음';/);
});
