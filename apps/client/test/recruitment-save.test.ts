import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getEffectiveDeckSlotIds,
  getOwnedCharacterIds,
  mergeGuestProgress,
  normalizeGuestProgress,
  type GuestProgress,
} from '../src/save.ts';
import { STAGES } from '../src/prototype.ts';

const base: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
  ownedRecruitmentCharacterIds: [],
  recruitmentProgressByBanner: {},
  characterProgressById: {},
};

test('guest progress keeps only known recruitment ownership ids and valid non-negative pull-history counters', () => {
  const normalized = normalizeGuestProgress({
    ...base,
    ownedRecruitmentCharacterIds: ['moon-eater', 'not-a-character', 'moon-eater'],
    recruitmentProgressByBanner: {
      'border-wonders-01': { totalPulls: 37 },
      broken: { totalPulls: -1 },
    },
  });
  assert.deepEqual(normalized.ownedRecruitmentCharacterIds, ['moon-eater']);
  assert.deepEqual(normalized.recruitmentProgressByBanner, {
    'border-wonders-01': { totalPulls: 37 },
  });
  assert.equal(normalized.characterProgressById?.['moon-eater']?.level, 1);
  assert.equal(normalized.characterProgressById?.['moon-eater']?.plusLevel, 0);
  assert.deepEqual(normalized.characterProgressById?.['moon-eater']?.unlockedFormIds, ['moon-eater-base']);
  assert.equal(normalized.characterProgressById?.['moon-eater']?.selectedFormId, 'moon-eater-base');
});

test('stored character progress clamps base and plus levels, drops foreign forms and never selects a locked form', () => {
  const normalized = normalizeGuestProgress({
    ...base,
    ownedRecruitmentCharacterIds: ['moon-eater'],
    characterProgressById: {
      'moon-eater': {
        level: 999,
        plusLevel: 999,
        unlockedFormIds: ['moon-eater-base', 'moon-eater-hollow', 'turnip-rider-king', 'missing-form'],
        selectedFormId: 'moon-eater-eclipse',
      },
    },
  });
  const meta = normalized.characterProgressById?.['moon-eater'];
  assert.equal(meta?.level, 50);
  assert.equal(meta?.plusLevel, 50);
  assert.deepEqual(meta?.unlockedFormIds, ['moon-eater-base', 'moon-eater-hollow']);
  assert.equal(meta?.selectedFormId, 'moon-eater-base');
});

test('durable/session merge keeps the farther pull history without inventing pity or selection state', () => {
  const durable: GuestProgress = {
    ...base,
    ownedRecruitmentCharacterIds: ['moon-eater'],
    recruitmentProgressByBanner: {
      'border-wonders-01': { totalPulls: 100 },
    },
  };
  const session: GuestProgress = {
    ...base,
    ownedRecruitmentCharacterIds: ['castle-crab'],
    recruitmentProgressByBanner: {
      'border-wonders-01': { totalPulls: 73 },
    },
  };
  const merged = mergeGuestProgress(durable, session);
  assert.deepEqual(new Set(merged.ownedRecruitmentCharacterIds), new Set(['moon-eater', 'castle-crab']));
  assert.deepEqual(merged.recruitmentProgressByBanner?.['border-wonders-01'], { totalPulls: 100 });
  assert.deepEqual(Object.keys(merged.recruitmentProgressByBanner?.['border-wonders-01'] ?? {}), ['totalPulls']);
});

test('when durable and session have different pull counts the farther valid history wins instead of summing', () => {
  const merged = mergeGuestProgress(
    {
      ...base,
      recruitmentProgressByBanner: { 'border-wonders-01': { totalPulls: 60 } },
    },
    {
      ...base,
      recruitmentProgressByBanner: { 'border-wonders-01': { totalPulls: 73 } },
    },
  );
  assert.equal(merged.recruitmentProgressByBanner?.['border-wonders-01']?.totalPulls, 73);
});

test('character progress merge keeps the highest base and plus growth independently', () => {
  const merged = mergeGuestProgress(
    {
      ...base,
      characterProgressById: {
        'moon-eater': { level: 50, plusLevel: 3, unlockedFormIds: ['moon-eater-base'], selectedFormId: 'moon-eater-base' },
      },
    },
    {
      ...base,
      characterProgressById: {
        'moon-eater': { level: 30, plusLevel: 12, unlockedFormIds: ['moon-eater-base', 'moon-eater-hollow'], selectedFormId: 'moon-eater-hollow' },
      },
    },
  );
  assert.equal(merged.characterProgressById?.['moon-eater']?.level, 50);
  assert.equal(merged.characterProgressById?.['moon-eater']?.plusLevel, 12);
  assert.deepEqual(merged.characterProgressById?.['moon-eater']?.unlockedFormIds, ['moon-eater-base', 'moon-eater-hollow']);
});

test('automatic formation preserves campaign unlock behavior until an explicit deck is saved', () => {
  const firstThreeClears = STAGES.slice(0, 3).map((stage) => stage.id);
  const progress = normalizeGuestProgress({ ...base, clearedStageIds: firstThreeClears });
  assert.deepEqual(getOwnedCharacterIds(progress), ['militia', 'guard', 'hunter']);
  assert.deepEqual(getEffectiveDeckSlotIds(progress), ['militia', 'guard', 'hunter']);
  assert.equal(progress.deckSlotIds, undefined);
});

test('explicit deck keeps only unique owned characters, caps at ten and overrides automatic formation', () => {
  const fullChapter = STAGES.map((stage) => stage.id);
  const normalized = normalizeGuestProgress({
    ...base,
    clearedStageIds: fullChapter,
    ownedRecruitmentCharacterIds: ['moon-eater', 'castle-crab'],
    deckSlotIds: ['moon-eater', 'militia', 'moon-eater', 'not-owned', 'castle-crab'],
  });
  assert.deepEqual(normalized.deckSlotIds, ['moon-eater', 'militia', 'castle-crab']);
  assert.deepEqual(getEffectiveDeckSlotIds(normalized), ['moon-eater', 'militia', 'castle-crab']);
  assert.equal(getOwnedCharacterIds(normalized).length, 12);
});

test('session deck selection wins a same-account durable merge while absent session selection preserves the stored deck', () => {
  const stored: GuestProgress = { ...base, deckSlotIds: ['militia'] };
  const session: GuestProgress = { ...base, deckSlotIds: ['militia', 'guard'] };
  assert.deepEqual(mergeGuestProgress(stored, session).deckSlotIds, ['militia', 'guard']);
  assert.deepEqual(mergeGuestProgress(stored, base).deckSlotIds, ['militia']);
});
