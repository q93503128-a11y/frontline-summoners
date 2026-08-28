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

test('guest progress keeps only canonical recruitment ownership ids and valid non-negative pull-history counters', () => {
  const normalized = normalizeGuestProgress({
    ...base,
    ownedRecruitmentCharacterIds: ['char_s01_mireille', 'moon-eater', 'not-a-character', 'char_s01_mireille'],
    recruitmentProgressByBanner: {
      'starlight-order-01': { totalPulls: 37 },
      broken: { totalPulls: -1 },
    },
  });
  assert.deepEqual(normalized.ownedRecruitmentCharacterIds, ['char_s01_mireille']);
  assert.deepEqual(normalized.recruitmentProgressByBanner, {
    'starlight-order-01': { totalPulls: 37 },
  });
  assert.equal(normalized.characterProgressById?.char_s01_mireille?.level, 1);
  assert.equal(normalized.characterProgressById?.char_s01_mireille?.plusLevel, 0);
  assert.deepEqual(normalized.characterProgressById?.char_s01_mireille?.unlockedFormIds, ['char_s01_mireille_f1']);
  assert.equal(normalized.characterProgressById?.char_s01_mireille?.selectedFormId, 'char_s01_mireille_f1');
});

test('stored character progress clamps base and plus levels, drops foreign forms and never selects a locked form', () => {
  const normalized = normalizeGuestProgress({
    ...base,
    ownedRecruitmentCharacterIds: ['char_s01_mireille'],
    characterProgressById: {
      char_s01_mireille: {
        level: 999,
        plusLevel: 999,
        unlockedFormIds: ['char_s01_mireille_f1', 'char_s01_mireille_f2', 'char_common_c_turnip_rider_f3', 'missing-form'],
        selectedFormId: 'char_s01_mireille_f3',
      },
    },
  });
  const meta = normalized.characterProgressById?.char_s01_mireille;
  assert.equal(meta?.level, 50);
  assert.equal(meta?.plusLevel, 50);
  assert.deepEqual(meta?.unlockedFormIds, ['char_s01_mireille_f1', 'char_s01_mireille_f2']);
  assert.equal(meta?.selectedFormId, 'char_s01_mireille_f1');
});

test('durable/session merge keeps the farther pull history per banner without inventing pity or selection state', () => {
  const durable: GuestProgress = {
    ...base,
    ownedRecruitmentCharacterIds: ['char_s01_mireille'],
    recruitmentProgressByBanner: {
      'starlight-order-01': { totalPulls: 100 },
      'primordial-titans-01': { totalPulls: 12 },
    },
  };
  const session: GuestProgress = {
    ...base,
    ownedRecruitmentCharacterIds: ['char_common_a_meteor_cart'],
    recruitmentProgressByBanner: {
      'starlight-order-01': { totalPulls: 73 },
      'primordial-titans-01': { totalPulls: 18 },
    },
  };
  const merged = mergeGuestProgress(durable, session);
  assert.deepEqual(new Set(merged.ownedRecruitmentCharacterIds), new Set(['char_s01_mireille', 'char_common_a_meteor_cart']));
  assert.deepEqual(merged.recruitmentProgressByBanner?.['starlight-order-01'], { totalPulls: 100 });
  assert.deepEqual(merged.recruitmentProgressByBanner?.['primordial-titans-01'], { totalPulls: 18 });
  assert.deepEqual(Object.keys(merged.recruitmentProgressByBanner?.['starlight-order-01'] ?? {}), ['totalPulls']);
});

test('when durable and session have different pull counts the farther valid history wins instead of summing', () => {
  const merged = mergeGuestProgress(
    {
      ...base,
      recruitmentProgressByBanner: { 'zero-edge-01': { totalPulls: 60 } },
    },
    {
      ...base,
      recruitmentProgressByBanner: { 'zero-edge-01': { totalPulls: 73 } },
    },
  );
  assert.equal(merged.recruitmentProgressByBanner?.['zero-edge-01']?.totalPulls, 73);
});

test('character progress merge keeps the highest base and plus growth independently', () => {
  const merged = mergeGuestProgress(
    {
      ...base,
      characterProgressById: {
        char_s01_mireille: { level: 50, plusLevel: 3, unlockedFormIds: ['char_s01_mireille_f1'], selectedFormId: 'char_s01_mireille_f1' },
      },
    },
    {
      ...base,
      characterProgressById: {
        char_s01_mireille: { level: 30, plusLevel: 12, unlockedFormIds: ['char_s01_mireille_f1', 'char_s01_mireille_f2'], selectedFormId: 'char_s01_mireille_f2' },
      },
    },
  );
  assert.equal(merged.characterProgressById?.char_s01_mireille?.level, 50);
  assert.equal(merged.characterProgressById?.char_s01_mireille?.plusLevel, 12);
  assert.deepEqual(merged.characterProgressById?.char_s01_mireille?.unlockedFormIds, ['char_s01_mireille_f1', 'char_s01_mireille_f2']);
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
    ownedRecruitmentCharacterIds: ['char_s01_mireille', 'char_common_a_meteor_cart'],
    deckSlotIds: ['char_s01_mireille', 'militia', 'char_s01_mireille', 'not-owned', 'char_common_a_meteor_cart'],
  });
  assert.deepEqual(normalized.deckSlotIds, ['char_s01_mireille', 'militia', 'char_common_a_meteor_cart']);
  assert.deepEqual(getEffectiveDeckSlotIds(normalized), ['char_s01_mireille', 'militia', 'char_common_a_meteor_cart']);
  assert.equal(getOwnedCharacterIds(normalized).length, 12);
});

test('session deck selection wins a same-account durable merge while absent session selection preserves the stored deck', () => {
  const stored: GuestProgress = { ...base, deckSlotIds: ['militia'] };
  const session: GuestProgress = { ...base, deckSlotIds: ['militia', 'guard'] };
  assert.deepEqual(mergeGuestProgress(stored, session).deckSlotIds, ['militia', 'guard']);
  assert.deepEqual(mergeGuestProgress(stored, base).deckSlotIds, ['militia']);
});
