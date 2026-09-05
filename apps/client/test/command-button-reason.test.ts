import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('shared command buttons expose inactive reasons on desktop hover and mobile tap without activating the action', async () => {
  const source = await readFile(new URL('../src/scene-ui.ts', import.meta.url), 'utf8');
  assert.match(source, /function isCommandButtonInactive/);
  assert.match(source, /controller\.reason\?\.trim\(\)/);
  assert.match(source, /const showReasonBubble = \(pointer: Phaser\.Input\.Pointer\)/);
  assert.match(source, /hit\.on\('pointerover',[\s\S]*showReasonBubble\(pointer\)/);
  assert.match(source, /hit\.on\('pointerdown',[\s\S]*isCommandButtonInactive\(controller\.state\)[\s\S]*showReasonBubble\(pointer\)[\s\S]*return/);
  assert.match(source, /hit\.on\('pointerup',[\s\S]*isCommandButtonInactive\(controller\.state\)[\s\S]*showReasonBubble\(pointer\)[\s\S]*return/);
  assert.match(source, /Phaser\.Math\.Clamp\(pointer\.x/);
  assert.match(source, /scene\.time\.delayedCall\(compact \? 2200 : 1600/);
  assert.match(source, /controller\.reason = reason/);
});
