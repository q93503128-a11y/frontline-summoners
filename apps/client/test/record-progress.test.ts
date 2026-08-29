import assert from 'node:assert/strict';
import test from 'node:test';
import { BOSS_RUSH_SEQUENCE, RECORD_MODE_DEFINITIONS, isRecordModeUnlocked } from '../src/record-content.ts';
import { STAGES } from '../src/prototype.ts';
import { getGuestRecordModeProgress, mergeGuestProgress, normalizeGuestProgress, type GuestProgress } from '../src/save.ts';

const EMPTY: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
  discoveredEnemyIds: [],
};
const CH1 = STAGES.slice(0, 20).map((stage) => stage.id);
const CH2 = STAGES.slice(20, 40).map((stage) => stage.id);
const CH3 = STAGES.slice(40, 60).map((stage) => stage.id);
const CH4 = STAGES.slice(60, 80).map((stage) => stage.id);

test('v1 exposes exactly the two canonical SOLO_ONLY record modes', () => {
  assert.deepEqual(RECORD_MODE_DEFINITIONS.map((mode) => mode.id), ['record_endless_front', 'record_boss_rush']);
  assert.ok(RECORD_MODE_DEFINITIONS.every((mode) => mode.multiplayerPolicy === 'SOLO_ONLY'));
  assert.ok(RECORD_MODE_DEFINITIONS.every((mode) => mode.speedMultiplier === 1 && mode.sweepAllowed === false));
  assert.equal(BOSS_RUSH_SEQUENCE.length, 9);
});

test('endless unlocks after chapter three and boss rush after chapter four', () => {
  assert.equal(isRecordModeUnlocked('record_endless_front', [...CH1, ...CH2, ...CH3.slice(0, 19)]), false);
  assert.equal(isRecordModeUnlocked('record_endless_front', [...CH1, ...CH2, ...CH3]), true);
  assert.equal(isRecordModeUnlocked('record_boss_rush', [...CH1, ...CH2, ...CH3, ...CH4.slice(0, 19)]), false);
  assert.equal(isRecordModeUnlocked('record_boss_rush', [...CH1, ...CH2, ...CH3, ...CH4]), true);
});

test('record progress defaults to zero and survives normal save normalization', () => {
  const progress = normalizeGuestProgress(EMPTY);
  assert.deepEqual(getGuestRecordModeProgress(progress), {
    endlessBestTimeMs: 0,
    endlessBestReachedMinute: 0,
    bossRushBestDefeated: 0,
  });
});

test('record score merge takes maxima and cannot roll a personal best backwards', () => {
  const a: GuestProgress = {
    ...EMPTY,
    recordModeProgress: { endlessBestTimeMs: 542000, endlessBestReachedMinute: 9, bossRushBestDefeated: 5 },
  };
  const b: GuestProgress = {
    ...EMPTY,
    recordModeProgress: { endlessBestTimeMs: 401000, endlessBestReachedMinute: 6, bossRushBestDefeated: 8 },
  };
  const merged = getGuestRecordModeProgress(mergeGuestProgress(a, b));
  assert.equal(merged.endlessBestTimeMs, 542000);
  assert.equal(merged.endlessBestReachedMinute, 9);
  assert.equal(merged.bossRushBestDefeated, 8);
});
