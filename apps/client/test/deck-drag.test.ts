import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DECK_SLOT_WIDTH, DECK_START_X, getDeckDropIndex, placeCharacterAtDeckIndex } from '../src/deck-drag.ts';

test('dragging an existing deck character onto another occupied slot swaps the exact hotkey positions', () => {
  assert.deepEqual(
    placeCharacterAtDeckIndex(['a', 'b', 'c', 'd'], 'a', 2),
    ['c', 'b', 'a', 'd'],
  );
  assert.deepEqual(
    placeCharacterAtDeckIndex(['a', 'b', 'c'], 'b', 9),
    ['a', 'c', 'b'],
  );
});

test('dragging an unselected owned character replaces an occupied slot or appends at the next contiguous slot', () => {
  assert.deepEqual(
    placeCharacterAtDeckIndex(['a', 'b', 'c'], 'x', 1),
    ['a', 'x', 'c'],
  );
  assert.deepEqual(
    placeCharacterAtDeckIndex(['a', 'b', 'c'], 'x', 7),
    ['a', 'b', 'c', 'x'],
  );
});

test('deck drop math covers exactly ten top-row slots and rejects off-row drops', () => {
  assert.equal(getDeckDropIndex(DECK_START_X + 1, 142, false), 0);
  assert.equal(getDeckDropIndex(DECK_START_X + DECK_SLOT_WIDTH * 9 + 50, 142, false), 9);
  assert.equal(getDeckDropIndex(DECK_START_X - 1, 142, false), undefined);
  assert.equal(getDeckDropIndex(DECK_START_X + DECK_SLOT_WIDTH * 10, 142, false), undefined);
  assert.equal(getDeckDropIndex(200, 250, false), undefined);
  assert.equal(getDeckDropIndex(200, 140 + 59, true), undefined);
});

test('deck scene wires pointer and touch drag surfaces without removing tap selection or save authority', async () => {
  const source = await readFile(new URL('../src/deck-scene.ts', import.meta.url), 'utf8');
  assert.match(source, /this\.input\.dragDistanceThreshold = compact \? 18 : 8/);
  assert.match(source, /this\.input\.setDraggable\(surface\)/);
  assert.match(source, /surface\.on\('dragstart'/);
  assert.match(source, /surface\.on\('drag'/);
  assert.match(source, /surface\.on\('dragend'/);
  assert.match(source, /getDeckDropIndex\(dragX, dragY, isCompactMobileViewport\(\)\)/);
  assert.match(source, /placeCharacterAtDeckIndex\(this\.selectedIds, slotId, targetIndex, MAX_DECK_SLOTS\)/);
  assert.match(source, /if \(!dragged\) this\.toggleCharacter\(slotId\)/);
  assert.match(source, /recordGuestDeck\(this\.selectedIds\)/);
  assert.match(source, /길게 끌어 상단 슬롯에 배치·교환/);
});
