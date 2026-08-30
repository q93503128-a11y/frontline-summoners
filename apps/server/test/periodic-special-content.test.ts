import assert from 'node:assert/strict';
import test from 'node:test';
import { isServerStageAvailable } from '../src/runtime-content.ts';

const GOLD_OPEN = Date.parse('2026-08-30T12:00:00+09:00');
const GOLD_CLOSED = Date.parse('2026-09-03T12:00:00+09:00');
const SOUL_OPEN = Date.parse('2026-09-01T12:00:00+09:00');
const SOUL_CLOSED = Date.parse('2026-09-04T12:00:00+09:00');

test('authoritative server applies the same recurring periodic availability schedule as the client', () => {
  assert.equal(isServerStageAvailable('special_gold_convoy_01', GOLD_OPEN), true);
  assert.equal(isServerStageAvailable('special_gold_convoy_05', GOLD_OPEN), true);
  assert.equal(isServerStageAvailable('special_gold_convoy_01', GOLD_CLOSED), false);
  assert.equal(isServerStageAvailable('special_soul_forge_01', SOUL_OPEN), true);
  assert.equal(isServerStageAvailable('special_soul_forge_04', SOUL_CLOSED), false);
  assert.equal(isServerStageAvailable('main_01_003', GOLD_CLOSED), true);
});
