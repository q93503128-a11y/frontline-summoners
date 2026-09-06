import assert from 'node:assert/strict';
import test from 'node:test';
import { computePvp2v2CompactRailLayout } from '../src/pvp-2v2-compact-layout.ts';

function assertFits(minimumTouch: number): void {
  const layout = computePvp2v2CompactRailLayout(minimumTouch, 5);
  const rightEdge = layout.margin
    + layout.buttonWidth
    + (layout.controlCount - 1) * (layout.buttonWidth + layout.gap);
  const bottomEdge = layout.buttonY + layout.buttonHeight / 2;
  assert.equal(layout.controlCount, 7);
  assert.ok(layout.buttonWidth >= minimumTouch, `button width ${layout.buttonWidth} must cover ${minimumTouch}`);
  assert.ok(layout.buttonHeight >= minimumTouch, `button height ${layout.buttonHeight} must cover ${minimumTouch}`);
  assert.ok(rightEdge <= 1280, `right edge ${rightEdge} must stay inside 1280`);
  assert.ok(bottomEdge <= 720, `bottom edge ${bottomEdge} must stay inside 720`);
}

test('390px portrait-equivalent 2v2 rail stays touch-safe and on-screen', () => {
  assertFits(145);
});

test('360px portrait-equivalent 2v2 rail stays touch-safe and on-screen', () => {
  assertFits(157);
});

test('320px portrait-equivalent 2v2 rail compresses spacing before touch targets', () => {
  assertFits(176);
  const layout = computePvp2v2CompactRailLayout(176, 5);
  assert.ok(layout.margin <= 16);
  assert.ok(layout.gap <= 6);
});
