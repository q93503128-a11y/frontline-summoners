import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeGuestProgress, normalizeGuestProgress, type GuestProgress } from '../src/save.ts';

const base: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  treasureIds: [],
  ownedRecruitmentCharacterIds: [],
  recruitmentProgressByBanner: {},
};

test('guest progress keeps only known recruitment ownership ids and valid non-negative banner counters', () => {
  const normalized = normalizeGuestProgress({
    ...base,
    ownedRecruitmentCharacterIds: ['moon-eater', 'not-a-character', 'moon-eater'],
    recruitmentProgressByBanner: {
      'border-wonders-01': { totalPulls: 37, selectionCredits: 0 },
      broken: { totalPulls: -1, selectionCredits: 5 },
    },
  });
  assert.deepEqual(normalized.ownedRecruitmentCharacterIds, ['moon-eater']);
  assert.deepEqual(normalized.recruitmentProgressByBanner, {
    'border-wonders-01': { totalPulls: 37, selectionCredits: 0 },
  });
});

test('durable/session merge never adds pull counts together or resurrects a consumed selection credit', () => {
  const durable: GuestProgress = {
    ...base,
    ownedRecruitmentCharacterIds: ['moon-eater'],
    recruitmentProgressByBanner: {
      'border-wonders-01': { totalPulls: 100, selectionCredits: 1 },
    },
  };
  const session: GuestProgress = {
    ...base,
    ownedRecruitmentCharacterIds: ['castle-crab'],
    recruitmentProgressByBanner: {
      'border-wonders-01': { totalPulls: 100, selectionCredits: 0 },
    },
  };
  const merged = mergeGuestProgress(durable, session);
  assert.deepEqual(new Set(merged.ownedRecruitmentCharacterIds), new Set(['moon-eater', 'castle-crab']));
  assert.deepEqual(merged.recruitmentProgressByBanner?.['border-wonders-01'], {
    totalPulls: 100,
    selectionCredits: 0,
  });
});

test('when durable and session have different pull counts the farther valid progression wins instead of summing', () => {
  const merged = mergeGuestProgress(
    {
      ...base,
      recruitmentProgressByBanner: { 'border-wonders-01': { totalPulls: 60, selectionCredits: 0 } },
    },
    {
      ...base,
      recruitmentProgressByBanner: { 'border-wonders-01': { totalPulls: 73, selectionCredits: 0 } },
    },
  );
  assert.equal(merged.recruitmentProgressByBanner?.['border-wonders-01']?.totalPulls, 73);
});
