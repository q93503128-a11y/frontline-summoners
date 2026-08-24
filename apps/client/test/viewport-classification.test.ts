import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMPACT_MOBILE_SHORT_SIDE,
  PORTRAIT_MOBILE_MAX_WIDTH,
  shouldBlockPortraitMobile,
  shouldUseCompactMobileUi,
} from '../src/viewport.ts';

test('compact UI requires a coarse primary pointer as well as a short mobile-sized viewport', () => {
  assert.equal(COMPACT_MOBILE_SHORT_SIDE, 540);
  assert.equal(shouldUseCompactMobileUi(844, 390, true), true);
  assert.equal(shouldUseCompactMobileUi(390, 844, true), true);
  assert.equal(shouldUseCompactMobileUi(1280, 500, false), false, 'short desktop window must keep desktop UI');
  assert.equal(shouldUseCompactMobileUi(500, 1280, false), false, 'narrow desktop window must keep desktop UI');
  assert.equal(shouldUseCompactMobileUi(1024, 768, true), false, 'large touch tablet should keep spacious layout');
});

test('portrait blocking applies only to phone-sized coarse-pointer portrait viewports', () => {
  assert.equal(PORTRAIT_MOBILE_MAX_WIDTH, 900);
  assert.equal(shouldBlockPortraitMobile(390, 844, true), true);
  assert.equal(shouldBlockPortraitMobile(844, 390, true), false);
  assert.equal(shouldBlockPortraitMobile(700, 1000, false), false, 'desktop portrait-like window must not be blocked');
  assert.equal(shouldBlockPortraitMobile(1000, 1400, true), false, 'large touch tablet is outside the phone portrait guard');
});
