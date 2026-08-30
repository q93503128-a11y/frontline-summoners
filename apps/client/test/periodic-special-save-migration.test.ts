import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeGuestProgress, normalizeGuestProgress, type GuestProgress } from '../src/save.ts';

function progress(specialClearedStageIds: readonly string[]): GuestProgress {
  return { clearedStageIds: [], specialClearedStageIds, permanentRewardIds: [] };
}

test('legacy periodic resource clear ids migrate to canonical SPECIAL ids without a schema reset', () => {
  const normalized = normalizeGuestProgress(progress([
    'resource_gold_01',
    'resource_gold_05',
    'resource_soul_04',
    'resource_evolution_03',
    'resource_starlight_02',
  ]));
  assert.deepEqual(normalized.specialClearedStageIds, [
    'special_gold_convoy_01',
    'special_gold_convoy_05',
    'special_soul_forge_04',
    'special_evolution_gate_03',
    'special_starlight_rift_02',
  ]);
});

test('legacy and canonical periodic clear ids de-duplicate during stale-save merge', () => {
  const merged = normalizeGuestProgress(mergeGuestProgress(
    progress(['resource_gold_01', 'resource_soul_01']),
    progress(['special_gold_convoy_01', 'special_soul_forge_01']),
  ));
  assert.deepEqual(merged.specialClearedStageIds, ['special_gold_convoy_01', 'special_soul_forge_01']);
});
