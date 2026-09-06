import assert from 'node:assert/strict';
import test from 'node:test';
import { computePvpCompactCommandLayout } from '../src/pvp-compact-command-layout.ts';

function assertFits(minimumTouch: number, expectedPageSize: number): void {
  const layout = computePvpCompactCommandLayout(minimumTouch, 10);
  const finalControlIndex = layout.pageSize + 2;
  const rightEdge = layout.margin + layout.buttonWidth + finalControlIndex * (layout.buttonWidth + layout.gap);
  const bottomEdge = layout.buttonY + layout.buttonHeight / 2;
  assert.equal(layout.pageSize, expectedPageSize);
  assert.ok(layout.buttonWidth >= minimumTouch, `button width ${layout.buttonWidth} must cover ${minimumTouch}`);
  assert.ok(layout.buttonHeight >= minimumTouch, `button height ${layout.buttonHeight} must cover ${minimumTouch}`);
  assert.ok(rightEdge <= 1280, `right edge ${rightEdge} must stay inside 1280`);
  assert.ok(bottomEdge <= 720, `bottom edge ${bottomEdge} must stay inside 720`);
}

test('390px portrait-equivalent touch target uses five summon commands per page', () => {
  assertFits(145, 5);
  const layout = computePvpCompactCommandLayout(145, 10);
  assert.equal(layout.pageCount, 2);
});

test('360px portrait-equivalent touch target uses four summon commands per page', () => {
  assertFits(157, 4);
  const layout = computePvpCompactCommandLayout(157, 10);
  assert.equal(layout.pageCount, 3);
});

test('phone landscape can keep all ten summon commands in one touch-safe row', () => {
  assertFits(81, 10);
  const layout = computePvpCompactCommandLayout(81, 10);
  assert.equal(layout.pageCount, 1);
});
